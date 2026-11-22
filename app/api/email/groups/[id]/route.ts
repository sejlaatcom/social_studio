import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
export const DELETE = route<{ id: string }>(async (_r, { params }) => { const c = await requireCtx("campaigns.manage"); await db.contactGroup.deleteMany({ where: { id: (await params).id, workspaceId: c.workspaceId } }); return { ok: true }; });
// PATCH {add:[contactIds], remove:[contactIds]}
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("campaigns.manage"); const { id } = await params;
  const b = await body(req, z.object({ add: z.array(z.string()).default([]), remove: z.array(z.string()).default([]) }));
  await db.contactGroup.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  const valid = (await db.contact.findMany({ where: { id: { in: b.add }, workspaceId: c.workspaceId }, select: { id: true } })).map((x) => x.id);
  await db.contactGroupMember.createMany({ data: valid.map((contactId) => ({ groupId: id, contactId })), skipDuplicates: true });
  await db.contactGroupMember.deleteMany({ where: { groupId: id, contactId: { in: b.remove } } });
  return { ok: true };
});
