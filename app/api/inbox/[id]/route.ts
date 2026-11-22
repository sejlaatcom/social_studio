import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("inbox.manage"); const { id } = await params;
  const b = await body(req, z.object({ status: z.enum(["open", "replied", "needs_follow_up", "closed"]).optional(), priority: z.enum(["high", "normal", "low"]).optional(), category: z.string().max(30).optional() }));
  await db.comment.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  return db.comment.update({ where: { id }, data: b });
});
