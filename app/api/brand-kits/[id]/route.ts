import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { BrandSchema } from "../schema";

export const GET = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx(); const { id } = await params;
  return db.brandKit.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
});
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("brand.manage"); const { id } = await params;
  const b = await body(req, BrandSchema.partial());
  await db.brandKit.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  if (b.isDefault) await db.brandKit.updateMany({ where: { workspaceId: c.workspaceId }, data: { isDefault: false } });
  const k = await db.brandKit.update({ where: { id }, data: b });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "brand.update", entityType: "BrandKit", entityId: id });
  return k;
});
export const DELETE = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("brand.manage"); const { id } = await params;
  await db.brandKit.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  await db.brandKit.delete({ where: { id } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "brand.delete", entityType: "BrandKit", entityId: id });
  return { ok: true };
});
