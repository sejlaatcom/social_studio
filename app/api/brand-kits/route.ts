import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { BrandSchema } from "./schema";


export const GET = route(async () => {
  const c = await requireCtx();
  return db.brandKit.findMany({ where: { workspaceId: c.workspaceId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
});
export const POST = route(async (req) => {
  const c = await requireCtx("brand.manage"); const b = await body(req, BrandSchema);
  const count = await db.brandKit.count({ where: { workspaceId: c.workspaceId } });
  if (b.isDefault || count === 0) await db.brandKit.updateMany({ where: { workspaceId: c.workspaceId }, data: { isDefault: false } });
  const kit = await db.brandKit.create({ data: { ...b, isDefault: b.isDefault || count === 0, workspaceId: c.workspaceId } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "brand.create", entityType: "BrandKit", entityId: kit.id });
  return kit;
});
