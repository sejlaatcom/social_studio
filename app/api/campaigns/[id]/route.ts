import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { CampaignSchema, toDates } from "../schema";

export const GET = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx(); const { id } = await params;
  const camp = await db.campaign.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: {
    posts: { include: { post: { include: { variants: { select: { id: true, platform: true, status: true, analytics: { orderBy: { capturedAt: "desc" }, take: 1 } } } } } } }, brandKit: { select: { id: true, name: true } } } });
  const posts = camp.posts.map((p) => p.post).sort((a, b) => +(a.scheduledAt ?? a.createdAt) - +(b.scheduledAt ?? b.createdAt));
  const metrics = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0 };
  for (const p of posts) for (const v of p.variants) { const m = v.analytics[0]; if (!m) continue; metrics.views += (m.views ?? 0) + (m.impressions ?? 0); metrics.likes += m.likes ?? 0; metrics.comments += m.comments ?? 0; metrics.shares += m.shares ?? 0; metrics.saves += m.saves ?? 0; metrics.reach += m.reach ?? 0; }
  const byStatus: Record<string, number> = {}; posts.forEach((p) => (byStatus[p.status] = (byStatus[p.status] ?? 0) + 1));
  return { ...camp, posts, metrics, byStatus, measured: posts.some((p) => p.variants.some((v) => v.analytics.length)) };
});
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("campaigns.manage"); const { id } = await params;
  const b = await body(req, CampaignSchema.partial());
  await db.campaign.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  const data: Record<string, unknown> = { ...b };
  if ("startDate" in b) data.startDate = b.startDate ? new Date(b.startDate) : null;
  if ("endDate" in b) data.endDate = b.endDate ? new Date(b.endDate) : null;
  void toDates;
  const r = await db.campaign.update({ where: { id }, data });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "campaign.update", entityType: "Campaign", entityId: id });
  return r;
});
export const DELETE = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("campaigns.manage"); const { id } = await params;
  await db.campaign.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  await db.campaign.delete({ where: { id } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "campaign.delete", entityType: "Campaign", entityId: id });
  return { ok: true };
});
