import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { getUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { checkLimit } from "@/lib/plans";
import { PROVIDERS, redirectUri, requireAppCreds } from "@/lib/integrations";
import type { ProviderId } from "@/lib/integrations/types";
import type { Platform } from "@/lib/platforms";

const back = (q: string) => NextResponse.redirect(`${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/accounts?${q}`);

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const sp = new URL(req.url).searchParams;
  if (sp.get("error")) return back(`error=${encodeURIComponent(sp.get("error_description") ?? sp.get("error")!)}`);
  const st = sp.get("state") ? await db.oAuthState.findUnique({ where: { state: sp.get("state")! } }) : null;
  if (!st || st.provider !== provider || st.expiresAt < new Date()) return back("error=" + encodeURIComponent("جلسة الربط منتهية أو غير صالحة، حاول مجددًا"));
  await db.oAuthState.delete({ where: { id: st.id } });
  const user = await getUser();
  if (!user || user.id !== st.userId) return back("error=" + encodeURIComponent("يجب أن تكون مسجل الدخول بنفس المستخدم"));
  const p = PROVIDERS[provider as ProviderId];
  try {
    const app = await requireAppCreds(st.workspaceId, p.id);
    const tokens = await p.exchangeCode({ app, code: sp.get("code") ?? "", redirectUri: redirectUri(p.id), codeVerifier: st.codeVerifier });
    const platform = st.redirectTo as Platform;
    const accounts = await p.discoverAccounts({ accessToken: tokens.accessToken, tokens, platform, scopes: tokens.scopes });
    if (!accounts.length) throw new Error("لم يتم العثور على حسابات مؤهلة");
    const extId = tokens.externalUserId ?? accounts[0].externalId;
    const data = { accessTokenEnc: encrypt(tokens.accessToken), refreshTokenEnc: tokens.refreshToken ? encrypt(tokens.refreshToken) : null, tokenType: tokens.tokenType, scopes: tokens.scopes,
      expiresAt: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null, status: "active", lastError: null, lastRefreshedAt: new Date() };
    const conn = await db.oAuthConnection.upsert({ where: { workspaceId_provider_externalUserId: { workspaceId: st.workspaceId, provider: p.id, externalUserId: `${extId}:${platform}` } },
      create: { workspaceId: st.workspaceId, provider: p.id, externalUserId: `${extId}:${platform}`, ...data }, update: data });
    for (const a of accounts) {
      const existing = await db.socialAccount.findUnique({ where: { workspaceId_platform_externalId: { workspaceId: st.workspaceId, platform: a.platform, externalId: a.externalId } } });
      if (!existing || existing.status === "disconnected") await checkLimit(st.workspaceId, "accounts");
      const fields = { connectionId: conn.id, username: a.username, displayName: a.displayName, avatarUrl: a.avatarUrl, followers: a.followers, meta: (a.meta ?? undefined) as object | undefined, permissions: tokens.scopes, status: "connected", lastError: null };
      await db.socialAccount.upsert({ where: { workspaceId_platform_externalId: { workspaceId: st.workspaceId, platform: a.platform, externalId: a.externalId } },
        create: { workspaceId: st.workspaceId, platform: a.platform, externalId: a.externalId, ...fields }, update: { ...fields, ...(existing?.status === "disconnected" ? { connectedAt: new Date() } : {}) } });
    }
    await audit({ workspaceId: st.workspaceId, userId: user.id, action: "account.connect", meta: { provider: p.id, platform, accounts: accounts.map((a) => a.displayName) } });
    await notify(st.workspaceId, { type: "account.connected", title: `تم ربط ${accounts.map((a) => a.displayName).join("، ")}`, link: "/accounts" });
    return back(`connected=${encodeURIComponent(platform)}`);
  } catch (e) {
    console.error("[oauth]", e);
    return back(`error=${encodeURIComponent((e as Error).message.slice(0, 300))}`);
  }
}
