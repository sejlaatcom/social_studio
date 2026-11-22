import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { queue, QUEUES } from "@/lib/queue";
import { rateLimit } from "@/lib/ratelimit";
export const POST = route(async () => {
  const c = await requireCtx("inbox.manage"); await rateLimit(`inboxsync:${c.workspaceId}`, 4, 600);
  const accs = await db.socialAccount.findMany({ where: { workspaceId: c.workspaceId, status: "connected", platform: { in: ["instagram", "youtube"] } } });
  for (const a of accs) await queue(QUEUES.analytics).add("sync", { socialAccountId: a.id });
  return { queued: accs.length };
});
