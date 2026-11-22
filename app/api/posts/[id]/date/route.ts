import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { schedulePost } from "@/lib/publishing";
import { badRequest, conflict } from "@/lib/errors";

// Calendar drag & drop: moves the planned date; re-queues jobs when the post is already scheduled.
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("content.edit"); const { id } = await params;
  const b = await body(req, z.object({ at: z.string().datetime() }));
  const at = new Date(b.at);
  const p = await db.post.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  if (["published", "publishing", "partially_published"].includes(p.status)) throw conflict("لا يمكن نقل منشور تم نشره");
  if (p.status === "scheduled") {
    if (!c.can("content.publish")) throw badRequest("تعديل موعد منشور مجدول يتطلب صلاحية النشر");
    if (at.getTime() < Date.now()) throw badRequest("لا يمكن الجدولة في الماضي");
    const r = await schedulePost(id, c.workspaceId, at, c.user.id);
    if (!r.ok) throw badRequest("فشل التحقق قبل إعادة الجدولة");
  } else await db.post.update({ where: { id }, data: { scheduledAt: at } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "post.move", entityType: "Post", entityId: id, meta: { at: b.at } });
  return { ok: true };
});
