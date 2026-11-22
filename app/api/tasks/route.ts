import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
export const GET = route(async () => { const c = await requireCtx(); return db.task.findMany({ where: { workspaceId: c.workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }); });
export const PATCH = route(async (req) => {
  const c = await requireCtx(); const b = await body(req, z.object({ id: z.string(), status: z.enum(["open", "done"]) }));
  await db.task.updateMany({ where: { id: b.id, workspaceId: c.workspaceId }, data: { status: b.status } }); return { ok: true };
});
