import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { analyticsSummary } from "@/lib/analytics";
import { parseRange } from "@/lib/range";

export const GET = route(async (req) => {
  const c = await requireCtx(); const ws = c.workspaceId;
  const { from, to } = parseRange(new URL(req.url).searchParams);
  const [accounts, published, scheduled, inReview, drafts, campaigns, upcoming, failures, activity, summary, accountsList] = await Promise.all([
    db.socialAccount.count({ where: { workspaceId: ws, status: { not: "disconnected" } } }),
    db.postVariant.count({ where: { post: { workspaceId: ws }, status: "published", publishedAt: { gte: from, lte: to } } }),
    db.post.count({ where: { workspaceId: ws, status: "scheduled" } }),
    db.post.count({ where: { workspaceId: ws, status: "in_review" } }),
    db.post.count({ where: { workspaceId: ws, status: { in: ["draft", "idea", "designing"] } } }),
    db.campaign.count({ where: { workspaceId: ws } }),
    db.post.findMany({ where: { workspaceId: ws, status: "scheduled", scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" }, take: 6, include: { variants: { select: { platform: true } } } }),
    db.postVariant.findMany({ where: { post: { workspaceId: ws }, status: "failed" }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, platform: true, lastError: true, updatedAt: true, post: { select: { id: true, title: true } } } }),
    db.auditLog.findMany({ where: { workspaceId: ws }, orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { name: true } } } }),
    analyticsSummary(ws, from, to),
    db.socialAccount.findMany({ where: { workspaceId: ws, status: { not: "disconnected" } }, select: { id: true, platform: true, displayName: true, status: true, followers: true } }),
  ]);
  return { counts: { accounts, published, scheduled, inReview, drafts, campaigns }, upcoming, failures, activity, summary, accounts: accountsList };
});
