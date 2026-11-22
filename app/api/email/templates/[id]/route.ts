import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
export const DELETE = route<{ id: string }>(async (_r, { params }) => { const c = await requireCtx("campaigns.manage"); await db.emailTemplate.deleteMany({ where: { id: (await params).id, workspaceId: c.workspaceId } }); return { ok: true }; });
