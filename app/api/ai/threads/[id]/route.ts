import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
export const GET = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx(); const { id } = await params;
  return db.chatThread.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId, userId: c.user.id } });
});
export const DELETE = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx(); const { id } = await params;
  await db.chatThread.deleteMany({ where: { id, workspaceId: c.workspaceId, userId: c.user.id } });
  return { ok: true };
});
