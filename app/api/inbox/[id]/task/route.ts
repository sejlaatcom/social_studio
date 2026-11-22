import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
export const POST = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("inbox.manage"); const { id } = await params;
  const cm = await db.comment.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: { socialAccount: true } });
  const task = await db.task.create({ data: { workspaceId: c.workspaceId, title: `متابعة تعليق ${cm.authorName} على ${cm.socialAccount.platform}`, notes: cm.text, sourceType: "comment", sourceId: id } });
  await db.comment.update({ where: { id }, data: { status: "needs_follow_up" } });
  return task;
});
