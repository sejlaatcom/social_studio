import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
export const POST = route(async (req) => {
  const c = await requireCtx("users.manage");
  const b = await body(req, z.object({ name: z.string().trim().min(2).max(60), permissions: z.array(z.string()).max(50) }));
  const perms = await db.permission.findMany({ where: { key: { in: b.permissions } } });
  const r = await db.role.create({ data: { workspaceId: c.workspaceId, key: `custom_${Date.now().toString(36)}`, name: b.name, nameAr: b.name, permissions: { create: perms.map((p) => ({ permissionId: p.id })) } } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "role.create", entityType: "Role", entityId: r.id });
  return r;
});
