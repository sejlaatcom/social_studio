import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccessToken, PUBLISHERS, PROVIDERS } from "@/lib/integrations";
import type { Platform } from "@/lib/platforms";
import type { ProviderId } from "@/lib/integrations/types";

// Live health check: obtains/refreshes a token and performs a lightweight authenticated read per account.
export const POST = route(async () => {
  const c = await requireCtx("settings.manage");
  const accounts = await db.socialAccount.findMany({ where: { workspaceId: c.workspaceId, status: { not: "disconnected" } }, include: { connection: true } });
  const results = [];
  for (const a of accounts) {
    const t0 = Date.now();
    try {
      const { token } = await getAccessToken(a.id);
      const pub = PUBLISHERS[a.platform as Platform];
      if (pub.accountMetrics) await pub.accountMetrics({ accessToken: token, account: { externalId: a.externalId, meta: a.meta as Record<string, unknown> | null } });
      else await PROVIDERS[a.connection!.provider as ProviderId].discoverAccounts({ accessToken: token, tokens: { accessToken: token, scopes: a.permissions }, platform: a.platform as Platform, scopes: a.permissions });
      results.push({ accountId: a.id, platform: a.platform, name: a.displayName, ok: true, ms: Date.now() - t0 });
    } catch (e) { results.push({ accountId: a.id, platform: a.platform, name: a.displayName, ok: false, error: (e as Error).message, ms: Date.now() - t0 }); }
  }
  return results;
});
