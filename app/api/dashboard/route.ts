import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { dashboardData } from "@/lib/dashboard";
import { parseRange } from "@/lib/range";

export const GET = route(async (req) => {
  const c = await requireCtx(); const ws = c.workspaceId;
  const { from, to, range } = parseRange(new URL(req.url).searchParams);
  const [accounts, scheduled, inReview, drafts, campaigns, activeCampaigns, upcoming, activity, dash] = await Promise.all([
    db.socialAccount.count({ where: { workspaceId: ws, status: { not: "disconnected" } } }),
    db.post.count({ where: { workspaceId: ws, status: "scheduled" } }),
    db.post.count({ where: { workspaceId: ws, status: "in_review" } }),
    db.post.count({ where: { workspaceId: ws, status: { in: ["draft", "idea", "designing"] } } }),
    db.campaign.count({ where: { workspaceId: ws } }),
    db.campaign.count({ where: { workspaceId: ws, status: "active" } }),
    db.post.findMany({ where: { workspaceId: ws, status: "scheduled", scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" }, take: 6, select: { id: true, title: true, scheduledAt: true, variants: { select: { platform: true } } } }),
    db.auditLog.findMany({ where: { workspaceId: ws, NOT: { action: { in: ["auth.login", "auth.login_failed"] } } }, orderBy: { createdAt: "desc" }, take: 12, include: { user: { select: { name: true } } } }),
    dashboardData(ws, from, to, { canApprove: c.can("content.approve"), userId: c.user.id }),
  ]);
  return { range: { from, to, key: range }, counts: { accounts, published: dash.kpis.published.value, scheduled, inReview, drafts, campaigns, activeCampaigns }, upcoming, activity, ...dash };
});
