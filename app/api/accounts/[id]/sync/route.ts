import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncAccount } from "@/lib/analytics";
import { rateLimit } from "@/lib/ratelimit";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const c = await requireCtx("reports.view"); const { id } = await params;
  await db.socialAccount.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  await rateLimit(`sync:${id}`, 6, 3600);
  return syncAccount(id);
});
