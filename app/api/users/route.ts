import { z } from "zod";
import bcrypt from "bcryptjs";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { checkLimit } from "@/lib/plans";
import { randomToken } from "@/lib/crypto";
import { conflict, badRequest } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/permissions";
import { notify } from "@/lib/notify";

export const GET = route(async () => {
  const c = await requireCtx();
  const [members, roles] = await Promise.all([
    db.membership.findMany({ where: { workspaceId: c.workspaceId }, include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true, mfaEnabled: true } }, role: true }, orderBy: { createdAt: "asc" } }),
    db.role.findMany({ where: { workspaceId: c.workspaceId }, include: { permissions: { include: { permission: true } }, _count: { select: { memberships: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  return { members, roles: roles.map((r) => ({ ...r, permissions: r.permissions.map((p) => p.permission.key) })), permissions: Object.entries(PERMISSIONS).map(([k, [ar, en]]) => ({ key: k, ar, en })), me: c.user.id };
});

// Adds a member. Existing users are attached; new users get a one-time temporary password shown to the admin.
export const POST = route(async (req) => {
  const c = await requireCtx("users.manage");
  const b = await body(req, z.object({ email: z.string().trim().toLowerCase().email(), name: z.string().trim().min(2).max(80), roleId: z.string() }));
  const role = await db.role.findFirst({ where: { id: b.roleId, workspaceId: c.workspaceId } }); if (!role) throw badRequest("دور غير صالح");
  if (role.key === "owner" && c.role.key !== "owner") throw badRequest("فقط المالك يمكنه إضافة مالك");
  await checkLimit(c.workspaceId, "users");
  let user = await db.user.findUnique({ where: { email: b.email } }); let tempPassword: string | null = null;
  if (!user) { tempPassword = randomToken(9); user = await db.user.create({ data: { email: b.email, name: b.name, passwordHash: await bcrypt.hash(tempPassword, 12) } }); }
  if (await db.membership.findUnique({ where: { userId_workspaceId: { userId: user.id, workspaceId: c.workspaceId } } })) throw conflict("المستخدم عضو بالفعل");
  await db.membership.create({ data: { userId: user.id, workspaceId: c.workspaceId, roleId: role.id } });
  await notify(c.workspaceId, { userId: user.id, type: "member.added", title: `أُضفت إلى مساحة العمل ${c.workspace.name} بدور ${role.nameAr}` });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "user.add", entityType: "User", entityId: user.id, meta: { role: role.key } });
  return { ok: true, tempPassword };
});
