import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { checkLimit } from "@/lib/plans";
import { CampaignSchema, toDates } from "./schema";

export const GET = route(async () => {
  const c = await requireCtx();
  const list = await db.campaign.findMany({ where: { workspaceId: c.workspaceId }, orderBy: { createdAt: "desc" }, include: { posts: { include: { post: { select: { status: true } } } } } });
  return list.map(({ posts, ...x }) => ({ ...x, postCount: posts.length, published: posts.filter((p) => ["published", "partially_published"].includes(p.post.status)).length, scheduled: posts.filter((p) => p.post.status === "scheduled").length }));
});
export const POST = route(async (req) => {
  const c = await requireCtx("campaigns.manage"); const b = await body(req, CampaignSchema);
  await checkLimit(c.workspaceId, "campaigns");
  const camp = await db.campaign.create({ data: { ...toDates(b), workspaceId: c.workspaceId } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "campaign.create", entityType: "Campaign", entityId: camp.id });
  return camp;
});
