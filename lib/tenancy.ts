import { db } from "./db";
import { PERMISSIONS, SYSTEM_ROLES } from "./permissions";
import { DEFAULT_PLANS } from "./plans";

export async function ensureCatalog() {
  for (const [key, [ar, en]] of Object.entries(PERMISSIONS))
    await db.permission.upsert({ where: { key }, create: { key, description: en, descriptionAr: ar }, update: { description: en, descriptionAr: ar } });
  for (const p of DEFAULT_PLANS)
    await db.plan.upsert({ where: { key: p.key }, create: { key: p.key, name: p.name, priceMonthly: p.priceMonthly, limits: p.limits }, update: { name: p.name, limits: p.limits } });
}

export async function createWorkspaceRoles(workspaceId: string) {
  const perms = await db.permission.findMany();
  const byKey = new Map(perms.map((p) => [p.key, p.id]));
  for (const r of SYSTEM_ROLES) {
    await db.role.create({ data: { workspaceId, key: r.key, name: r.name, nameAr: r.nameAr, isSystem: true,
      permissions: { create: r.perms.map((k) => ({ permissionId: byKey.get(k)! })) } } });
  }
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "org";

export async function createOrganization(ownerId: string, name: string) {
  await ensureCatalog();
  const plan = await db.plan.findUnique({ where: { key: process.env.DEFAULT_PLAN ?? "pro" } });
  const org = await db.organization.create({ data: { name, slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`, planId: plan?.id } });
  if (plan) await db.subscription.create({ data: { organizationId: org.id, planId: plan.id, status: "active" } });
  const ws = await db.workspace.create({ data: { organizationId: org.id, name, slug: "main" } });
  await createWorkspaceRoles(ws.id);
  const owner = await db.role.findFirstOrThrow({ where: { workspaceId: ws.id, key: "owner" } });
  await db.membership.create({ data: { userId: ownerId, workspaceId: ws.id, roleId: owner.id } });
  return { org, ws };
}
