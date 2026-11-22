import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = route<{ id: string }>(async (_r, { params }) => { const c = await requireCtx(); return db.contentIdea.findFirstOrThrow({ where: { id: (await params).id, workspaceId: c.workspaceId } }); });
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("content.edit"); const { id } = await params;
  const b = await body(req, z.object({ title: z.string().min(1).max(200).optional(), body: z.string().max(10000).nullish(), tags: z.array(z.string()).optional(), status: z.enum(["new", "in_progress", "used", "archived"]).optional() }));
  await db.contentIdea.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  return db.contentIdea.update({ where: { id }, data: b });
});
export const DELETE = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("content.delete"); const { id } = await params;
  await db.contentIdea.deleteMany({ where: { id, workspaceId: c.workspaceId } }); return { ok: true };
});
