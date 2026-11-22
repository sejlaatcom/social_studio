import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = route(async () => {
  const c = await requireCtx();
  const where = { workspaceId: c.workspaceId, userId: c.user.id };
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 30 }),
    db.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return { items, unread };
});
export const PATCH = route(async (req) => {
  const c = await requireCtx();
  const b = await body(req, z.object({ id: z.string().optional(), all: z.boolean().optional() }));
  await db.notification.updateMany({ where: { workspaceId: c.workspaceId, userId: c.user.id, readAt: null, ...(b.id ? { id: b.id } : {}) }, data: { readAt: new Date() } });
  return { ok: true };
});
