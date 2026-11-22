import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { schedulePost, cancelSchedule } from "@/lib/publishing";
import { badRequest, forbidden } from "@/lib/errors";
import { getSetting } from "@/lib/settings";

// POST {mode:"now"} | {mode:"schedule", at:ISO}
export const POST = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("content.publish"); const { id } = await params;
  const b = await body(req, z.object({ mode: z.enum(["now", "schedule"]), at: z.string().datetime().optional() }));
  const post = await db.post.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  const requireApproval = (await getSetting<boolean>(c.workspaceId, "workflow.requireApproval")) ?? false;
  if (requireApproval && post.status !== "approved" && post.status !== "scheduled" && post.status !== "failed" && post.status !== "partially_published") {
    if (!c.can("content.approve")) throw forbidden("يجب اعتماد المنشور قبل جدولته أو نشره");
  }
  const at = b.mode === "now" ? new Date() : new Date(b.at ?? "");
  if (b.mode === "schedule" && (isNaN(at.getTime()) || at.getTime() < Date.now() - 60000)) throw badRequest("موعد الجدولة يجب أن يكون في المستقبل");
  const r = await schedulePost(id, c.workspaceId, at, c.user.id);
  if (r.ok) await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: b.mode === "now" ? "post.publish_now" : "post.schedule", entityType: "Post", entityId: id, meta: { at: at.toISOString() } });
  return r;
});

export const DELETE = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("content.publish"); const { id } = await params;
  await cancelSchedule(id, c.workspaceId);
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "post.unschedule", entityType: "Post", entityId: id });
  return { ok: true };
});
