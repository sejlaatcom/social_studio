import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export const GET = route(async (req) => {
  const c = await requireCtx(); const sp = new URL(req.url).searchParams; const q = sp.get("q");
  return db.contact.findMany({ where: { workspaceId: c.workspaceId, ...(sp.get("groupId") ? { groups: { some: { groupId: sp.get("groupId")! } } } : {}), ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}) },
    orderBy: { createdAt: "desc" }, take: 500, include: { groups: { include: { group: { select: { id: true, name: true } } } } } });
});
// Accepts a list (from form or parsed CSV). Contacts must have consented to receive marketing email.
export const POST = route(async (req) => {
  const c = await requireCtx("campaigns.manage");
  const b = await body(req, z.object({ contacts: z.array(z.object({ email: z.string().trim().toLowerCase().email(), name: z.string().max(120).nullish(), tags: z.array(z.string()).default([]) })).min(1).max(5000), groupId: z.string().nullish(), consent: z.literal(true) }));
  let created = 0;
  for (const ct of b.contacts) {
    const row = await db.contact.upsert({ where: { workspaceId_email: { workspaceId: c.workspaceId, email: ct.email } }, create: { workspaceId: c.workspaceId, email: ct.email, name: ct.name ?? null, tags: ct.tags }, update: { ...(ct.name ? { name: ct.name } : {}) } });
    if (b.groupId) await db.contactGroupMember.upsert({ where: { groupId_contactId: { groupId: b.groupId, contactId: row.id } }, create: { groupId: b.groupId, contactId: row.id }, update: {} });
    created++;
  }
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "email.contacts_import", meta: { count: created } });
  return { created };
});
export const DELETE = route(async (req) => {
  const c = await requireCtx("campaigns.manage"); const { ids } = await body(req, z.object({ ids: z.array(z.string()).min(1).max(1000) }));
  await db.contact.deleteMany({ where: { id: { in: ids }, workspaceId: c.workspaceId } }); return { ok: true };
});
