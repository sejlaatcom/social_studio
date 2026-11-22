import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignPlan } from "@/lib/ai/service";
import { badRequest } from "@/lib/errors";

export const maxDuration = 300;
export const POST = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("campaigns.manage"); const { id } = await params;
  const camp = await db.campaign.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  if (!camp.platforms.length) throw badRequest("حدد منصة واحدة على الأقل للحملة");
  const plan = await campaignPlan({ workspaceId: c.workspaceId, userId: c.user.id }, id);
  await db.campaign.update({ where: { id }, data: { plan: plan as object } });
  return plan;
});
