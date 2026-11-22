import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { forbidden } from "@/lib/errors";

// action: submit (writer → review) | approve | reject | changes_requested
export const POST = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx(); const { id } = await params;
  const b = await body(req, z.object({ action: z.enum(["submit", "approve", "reject", "changes_requested"]), note: z.string().max(2000).optional() }));
  const post = await db.post.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  if (b.action === "submit") {
    if (!c.can("content.edit")) throw forbidden();
    await db.post.update({ where: { id }, data: { status: "in_review" } });
    await db.approval.create({ data: { postId: id, status: "pending", note: b.note } });
    const reviewers = await db.membership.findMany({ where: { workspaceId: c.workspaceId, role: { permissions: { some: { permission: { key: "content.approve" } } } } } });
    for (const r of reviewers) if (r.userId !== c.user.id) await notify(c.workspaceId, { userId: r.userId, type: "approval.requested", title: `"${post.title}" بانتظار الاعتماد`, body: b.note, link: `/posts/${id}` });
  } else {
    if (!c.can("content.approve")) throw forbidden("لا تملك صلاحية اعتماد المحتوى");
    const status = b.action === "approve" ? "approved" : b.action === "reject" ? "rejected" : "changes_requested";
    const pending = await db.approval.findFirst({ where: { postId: id, status: "pending" }, orderBy: { createdAt: "desc" } });
    if (pending) await db.approval.update({ where: { id: pending.id }, data: { status, reviewerId: c.user.id, note: b.note, decidedAt: new Date() } });
    else await db.approval.create({ data: { postId: id, status, reviewerId: c.user.id, note: b.note, decidedAt: new Date() } });
    await db.post.update({ where: { id }, data: { status: b.action === "approve" ? "approved" : "draft" } });
    if (post.authorId) await notify(c.workspaceId, { userId: post.authorId, type: `approval.${status}`, title: b.action === "approve" ? `تم اعتماد "${post.title}"` : `"${post.title}" يحتاج تعديلات`, body: b.note, link: `/posts/${id}` });
  }
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: `post.${b.action}`, entityType: "Post", entityId: id });
  return { ok: true };
});
