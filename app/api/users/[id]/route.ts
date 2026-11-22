import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";

async function guardOwner(workspaceId: string, membershipId: string) {
  const m = await db.membership.findFirstOrThrow({ where: { id: membershipId, workspaceId }, include: { role: true } });
  if (m.role.key === "owner" && (await db.membership.count({ where: { workspaceId, role: { key: "owner" } } })) <= 1) throw badRequest("لا يمكن إزالة أو تغيير دور المالك الوحيد");
  return m;
}
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("users.manage"); const { id } = await params;
  const { roleId } = await body(req, z.object({ roleId: z.string() }));
  const role = await db.role.findFirstOrThrow({ where: { id: roleId, workspaceId: c.workspaceId } });
  if (role.key === "owner" && c.role.key !== "owner") throw badRequest("فقط المالك يمكنه تعيين مالك");
  const m = await guardOwner(c.workspaceId, id);
  await db.membership.update({ where: { id }, data: { roleId } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "user.role_change", entityType: "User", entityId: m.userId, meta: { role: role.key } });
  return { ok: true };
});
export const DELETE = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("users.manage"); const { id } = await params;
  const m = await guardOwner(c.workspaceId, id);
  await db.membership.delete({ where: { id } });
  await db.session.deleteMany({ where: { userId: m.userId } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "user.remove", entityType: "User", entityId: m.userId });
  return { ok: true };
});
