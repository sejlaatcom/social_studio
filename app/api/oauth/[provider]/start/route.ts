import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { pkcePair, randomToken } from "@/lib/crypto";
import { PROVIDERS, redirectUri, requireAppCreds } from "@/lib/integrations";
import { badRequest } from "@/lib/errors";
import type { ProviderId } from "@/lib/integrations/types";
import type { Platform } from "@/lib/platforms";

// GET /api/oauth/:provider/start?platform=youtube — redirects to the provider consent screen
export const GET = route<{ provider: string }>(async (req, { params }) => {
  const { provider } = await params;
  const ctx = await requireCtx("accounts.connect");
  const p = PROVIDERS[provider as ProviderId]; if (!p) throw badRequest("مزود غير معروف");
  const platform = (new URL(req.url).searchParams.get("platform") ?? p.platforms[0]) as Platform;
  if (!p.platforms.includes(platform)) throw badRequest("منصة غير صالحة لهذا المزود");
  const app = await requireAppCreds(ctx.workspaceId, p.id);
  const state = randomToken(24);
  const pk = p.usesPkce ? pkcePair() : null;
  await db.oAuthState.create({ data: { state, provider: p.id, workspaceId: ctx.workspaceId, userId: ctx.user.id, codeVerifier: pk?.verifier, redirectTo: platform, expiresAt: new Date(Date.now() + 15 * 60000) } });
  return NextResponse.redirect(p.authUrl({ app, redirectUri: redirectUri(p.id), state, codeChallenge: pk?.challenge, platform }));
});
