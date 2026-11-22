import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
export const GET = route(async () => { const c = await requireCtx(); return db.emailTemplate.findMany({ where: { workspaceId: c.workspaceId }, orderBy: { updatedAt: "desc" } }); });
export const POST = route(async (req) => { const c = await requireCtx("campaigns.manage"); const b = await body(req, z.object({ name: z.string().min(1).max(120), subject: z.string().max(300), html: z.string().max(500000) })); return db.emailTemplate.create({ data: { ...b, workspaceId: c.workspaceId } }); });
