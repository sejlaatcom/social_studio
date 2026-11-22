import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
export const GET = route(async () => {
  const c = await requireCtx();
  return db.chatThread.findMany({ where: { workspaceId: c.workspaceId, userId: c.user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, updatedAt: true }, take: 50 });
});
