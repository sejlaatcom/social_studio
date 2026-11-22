import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { badRequest, conflict } from "@/lib/errors";
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("users.manage"); const { id } = await params;
  const b = await body(req, z.object({ permissions: z.array(z.string()).max(50), name: z.string().min(2).max(60).optional() }));
  const r = await db.role.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  if (r.key === "owner") throw badRequest("صلاحيات المالك ثابتة");
  const perms = await db.permission.findMany({ where: { key: { in: b.permissions } } });
  await db.$transaction([db.rolePermission.deleteMany({ where: { roleId: id } }), db.rolePermission.createMany({ data: perms.map((p) => ({ roleId: id, permissionId: p.id })) }), ...(b.name && !r.isSystem ? [db.role.update({ where: { id }, data: { name: b.name, nameAr: b.name } })] : [])]);
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "role.update", entityType: "Role", entityId: id, meta: { permissions: b.permissions } });
  return { ok: true };
});
export const DELETE = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("users.manage"); const { id } = await params;
  const r = await db.role.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: { _count: { select: { memberships: true } } } });
  if (r.isSystem) throw badRequest("لا يمكن حذف الأدوار الأساسية");
  if (r._count.memberships) throw conflict("الدور مسند لمستخدمين");
  await db.role.delete({ where: { id } }); return { ok: true };
});
