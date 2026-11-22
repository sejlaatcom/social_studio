import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = route<{ id: string }>(async (_r, { params }) => { const c = await requireCtx(); return db.designProject.findFirstOrThrow({ where: { id: (await params).id, workspaceId: c.workspaceId } }); });
export const PUT = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("content.edit"); const { id } = await params;
  const b = await body(req, z.object({ name: z.string().min(1).max(200).optional(), document: z.object({ background: z.any(), layers: z.array(z.any()).max(200) }).optional(), isTemplate: z.boolean().optional() }));
  await db.designProject.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  return db.designProject.update({ where: { id }, data: b });
});
export const DELETE = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("content.delete"); const { id } = await params;
  await db.designProject.deleteMany({ where: { id, workspaceId: c.workspaceId } }); return { ok: true };
});
// POST = duplicate
export const POST = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("content.create"); const { id } = await params;
  const d = await db.designProject.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  return db.designProject.create({ data: { workspaceId: c.workspaceId, name: `${d.name} (نسخة)`, preset: d.preset, width: d.width, height: d.height, document: d.document as object } });
});
