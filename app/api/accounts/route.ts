import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAppCreds, PROVIDERS } from "@/lib/integrations";
import { PLATFORM_INFO, PLATFORMS } from "@/lib/platforms";
import type { ProviderId } from "@/lib/integrations/types";

export const GET = route(async () => {
  const c = await requireCtx();
  const accounts = await db.socialAccount.findMany({
    where: { workspaceId: c.workspaceId, status: { not: "disconnected" } }, orderBy: { connectedAt: "asc" },
    include: { connection: { select: { status: true, expiresAt: true, scopes: true, lastRefreshedAt: true, lastError: true } }, _count: { select: { variants: { where: { status: "published" } } } } },
  });
  const configured: Record<string, boolean> = {};
  for (const id of Object.keys(PROVIDERS)) configured[id] = !!(await getAppCreds(c.workspaceId, id as ProviderId));
  return { accounts, platforms: PLATFORMS.map((p) => PLATFORM_INFO[p]), configured };
});
