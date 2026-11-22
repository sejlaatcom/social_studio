import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { queue, QUEUES } from "@/lib/queue";
import { checkLimit } from "@/lib/plans";
import { badRequest, conflict } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const POST = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("content.create"); const { id } = await params;
  const v = await db.videoProject.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: { _count: { select: { scenes: true } } } });
  if (v.status === "rendering") throw conflict("الإخراج قيد التنفيذ");
  if (!v._count.scenes) throw badRequest("أضف مشهدًا واحدًا على الأقل");
  await checkLimit(c.workspaceId, "videos");
  await db.videoProject.update({ where: { id }, data: { status: "rendering", renderError: null } });
  await queue(QUEUES.video).add("render", { videoId: id }, { attempts: 1 });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "video.render", entityType: "VideoProject", entityId: id });
  return { ok: true };
});
