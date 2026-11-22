import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { suggestReplies } from "@/lib/ai/service";

export const maxDuration = 120;
export const POST = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("ai.use"); const { id } = await params;
  const cm = await db.comment.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: { socialAccount: true } });
  const r = await suggestReplies({ workspaceId: c.workspaceId, userId: c.user.id }, { text: cm.text, author: cm.authorName, platform: cm.socialAccount.platform });
  await db.comment.update({ where: { id }, data: { category: r.category, priority: r.priority, status: r.needsFollowUp && cm.status === "open" ? "needs_follow_up" : cm.status } });
  return r;
});
