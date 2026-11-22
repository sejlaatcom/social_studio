import { CampaignBody } from "./schema";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
export const GET = route(async () => { const c = await requireCtx(); return db.emailCampaign.findMany({ where: { workspaceId: c.workspaceId }, orderBy: { updatedAt: "desc" }, include: { group: { select: { name: true, _count: { select: { members: true } } } } } }); });
export const POST = route(async (req) => {
  const c = await requireCtx("campaigns.manage"); const b = await body(req, CampaignBody);
  const e = await db.emailCampaign.create({ data: { ...b, workspaceId: c.workspaceId } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "email.campaign_create", entityType: "EmailCampaign", entityId: e.id }); return e;
});
