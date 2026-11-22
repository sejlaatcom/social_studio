import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
export const GET = route(async () => { const c = await requireCtx(); return db.contactGroup.findMany({ where: { workspaceId: c.workspaceId }, include: { _count: { select: { members: true } } }, orderBy: { createdAt: "asc" } }); });
export const POST = route(async (req) => { const c = await requireCtx("campaigns.manage"); const b = await body(req, z.object({ name: z.string().trim().min(1).max(80) })); return db.contactGroup.create({ data: { workspaceId: c.workspaceId, name: b.name } }); });
