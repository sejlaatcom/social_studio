import { db } from "../db";
import { decrypt, encrypt } from "../crypto";
import { notify } from "../notify";
import { notConfigured } from "../errors";
import type { Platform } from "../platforms";
import { googleProvider, gmailPublisher, youtubePublisher } from "./google";
import { instagramProvider, instagramPublisher } from "./instagram";
import { xProvider, xPublisher } from "./x";
import { tiktokProvider, tiktokPublisher } from "./tiktok";
import { snapchatProvider, snapchatPublisher } from "./snapchat";
import { IntegrationError, type AppCreds, type IntegrationProvider, type PlatformPublisher, type ProviderId } from "./types";

export const PROVIDERS: Record<ProviderId, IntegrationProvider> = { google: googleProvider, instagram: instagramProvider, x: xProvider, tiktok: tiktokProvider, snapchat: snapchatProvider };
export const PUBLISHERS: Record<Platform, PlatformPublisher> = { gmail: gmailPublisher, youtube: youtubePublisher, instagram: instagramPublisher, x: xPublisher, tiktok: tiktokPublisher, snapchat: snapchatPublisher };
export const PLATFORM_PROVIDER: Record<Platform, ProviderId> = { gmail: "google", youtube: "google", instagram: "instagram", x: "x", tiktok: "tiktok", snapchat: "snapchat" };

export function redirectUri(provider: ProviderId) {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/oauth/${provider}/callback`;
}

export async function getAppCreds(workspaceId: string, provider: ProviderId): Promise<AppCreds | null> {
  const app = await db.integrationApp.findUnique({ where: { workspaceId_provider: { workspaceId, provider } } });
  if (app) return { clientId: app.clientId, clientSecret: decrypt(app.clientSecretEnc) };
  const p = PROVIDERS[provider].envPrefix;
  const id = process.env[`${p}_CLIENT_ID`], secret = process.env[`${p}_CLIENT_SECRET`];
  return id && secret ? { clientId: id, clientSecret: secret } : null;
}
export async function requireAppCreds(workspaceId: string, provider: ProviderId) {
  const c = await getAppCreds(workspaceId, provider);
  if (!c) throw notConfigured(`لم يتم إعداد تطبيق ${PROVIDERS[provider].name}. أضف Client ID وClient Secret من الإعدادات ← التكاملات.`);
  return c;
}

/** Returns a valid access token for a social account, refreshing it when it is about to expire. */
export async function getAccessToken(socialAccountId: string): Promise<{ token: string; account: NonNullable<Awaited<ReturnType<typeof loadAccount>>> }> {
  const account = await loadAccount(socialAccountId);
  if (!account) throw new IntegrationError("internal", "الحساب غير موجود");
  const conn = account.connection;
  if (!conn) throw new IntegrationError(account.platform, "الحساب غير مرتبط بأي اتصال OAuth", { needsReauth: true });
  if (conn.status === "revoked") throw new IntegrationError(account.platform, "تم سحب صلاحيات هذا الحساب. أعد الربط.", { needsReauth: true });
  const soon = conn.expiresAt && conn.expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
  if (!soon) return { token: decrypt(conn.accessTokenEnc), account };
  const provider = PROVIDERS[conn.provider as ProviderId];
  const app = await requireAppCreds(conn.workspaceId, conn.provider as ProviderId);
  try {
    const t = await provider.refresh({ app, refreshToken: conn.refreshTokenEnc ? decrypt(conn.refreshTokenEnc) : null, accessToken: decrypt(conn.accessTokenEnc) });
    await db.oAuthConnection.update({ where: { id: conn.id }, data: {
      accessTokenEnc: encrypt(t.accessToken), refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken) : conn.refreshTokenEnc,
      expiresAt: t.expiresIn ? new Date(Date.now() + t.expiresIn * 1000) : null, status: "active", lastError: null, lastRefreshedAt: new Date(),
    } });
    return { token: t.accessToken, account };
  } catch (e) {
    await markNeedsReauth(conn.id, (e as Error).message);
    throw new IntegrationError(account.platform, `انتهت صلاحية الاتصال ولم يمكن تجديده: ${(e as Error).message}`, { needsReauth: true });
  }
}

function loadAccount(id: string) {
  return db.socialAccount.findUnique({ where: { id }, include: { connection: true } });
}

export async function markNeedsReauth(connectionId: string, error: string) {
  const conn = await db.oAuthConnection.update({ where: { id: connectionId }, data: { status: "expired", lastError: error.slice(0, 1000) }, include: { accounts: true } });
  await db.socialAccount.updateMany({ where: { connectionId }, data: { status: "needs_reauth", lastError: error.slice(0, 1000) } });
  for (const a of conn.accounts) {
    if (a.status !== "needs_reauth") await notify(conn.workspaceId, { type: "account.reauth", title: `يحتاج الحساب ${a.displayName} إلى إعادة الربط`, body: error.slice(0, 300), link: "/accounts" });
  }
}

export { IntegrationError };
