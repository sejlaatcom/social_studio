import { db } from "./db";
import { analyticsSummary } from "./analytics";

type Bucket = { key: string; start: number; end: number };

/** Continuous buckets (hourly for ≤ 2 days, otherwise daily) so charts show every period, including empty ones. */
function buckets(from: Date, to: Date): { unit: "hour" | "day"; list: Bucket[] } {
  const span = to.getTime() - from.getTime();
  const unit = span <= 2 * 86400000 ? "hour" : "day";
  const step = unit === "hour" ? 3600000 : 86400000;
  const start = new Date(from); if (unit === "hour") start.setMinutes(0, 0, 0); else start.setHours(0, 0, 0, 0);
  const list: Bucket[] = [];
  for (let t = start.getTime(); t <= to.getTime() && list.length < 400; t += step) list.push({ key: new Date(t).toISOString(), start: t, end: t + step - 1 });
  return { unit, list };
}
const idx = (list: Bucket[], d: Date) => { const t = d.getTime(); return list.findIndex((b) => t >= b.start && t <= b.end); };
const pct = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : cur > 0 ? null : 0);

async function followerSeries(workspaceId: string, list: Bucket[], platform?: string) {
  const accounts = await db.socialAccount.findMany({ where: { workspaceId, status: { not: "disconnected" }, ...(platform ? { platform } : {}) }, select: { id: true } });
  if (!accounts.length || !list.length) return { series: list.map(() => null as number | null), gained: null as number | null };
  const snaps = await db.analyticsSnapshot.findMany({
    where: { socialAccountId: { in: accounts.map((a) => a.id) }, scope: "account", followers: { not: null }, capturedAt: { lte: new Date(list[list.length - 1].end) } },
    orderBy: { capturedAt: "asc" }, select: { socialAccountId: true, capturedAt: true, followers: true },
  });
  const byAcc = new Map<string, { t: number; f: number }[]>();
  for (const s of snaps) { const a = byAcc.get(s.socialAccountId) ?? []; a.push({ t: s.capturedAt.getTime(), f: s.followers! }); byAcc.set(s.socialAccountId, a); }
  // Sum of the last known follower count per account at the end of each bucket (carry forward; never invented).
  const series = list.map((b) => {
    let total = 0, any = false;
    for (const arr of byAcc.values()) { let last: number | null = null; for (const x of arr) { if (x.t <= b.end) last = x.f; else break; } if (last !== null) { total += last; any = true; } }
    return any ? total : null;
  });
  // Gained within the period: per account (last in period − last before/first in period).
  let gained: number | null = null;
  const start = list[0].start;
  for (const arr of byAcc.values()) {
    const before = [...arr].reverse().find((x) => x.t < start) ?? arr.find((x) => x.t >= start);
    const after = [...arr].reverse().find((x) => x.t <= list[list.length - 1].end);
    if (before && after && after.t >= start) gained = (gained ?? 0) + (after.f - before.f);
  }
  return { series, gained };
}

export async function dashboardData(workspaceId: string, from: Date, to: Date, o: { canApprove: boolean; userId: string }) {
  const span = to.getTime() - from.getTime();
  const pFrom = new Date(from.getTime() - span - 1), pTo = new Date(from.getTime() - 1);
  const { unit, list } = buckets(from, to);
  const prevList = list.map((b) => ({ ...b, start: b.start - span - 1, end: b.end - span - 1 }));
  const ws = workspaceId;

  const [cur, prev, published, prevPublished, fol, prevFol, accounts] = await Promise.all([
    analyticsSummary(ws, from, to), analyticsSummary(ws, pFrom, pTo),
    db.postVariant.findMany({ where: { post: { workspaceId: ws }, status: "published", publishedAt: { gte: from, lte: to } }, select: { platform: true, publishedAt: true } }),
    db.postVariant.count({ where: { post: { workspaceId: ws }, status: "published", publishedAt: { gte: pFrom, lte: pTo } } }),
    followerSeries(ws, list), followerSeries(ws, prevList),
    db.socialAccount.findMany({ where: { workspaceId: ws, status: { not: "disconnected" } }, select: { id: true, platform: true, displayName: true, status: true, followers: true, lastSyncAt: true } }),
  ]);

  const series = list.map((b, i) => ({ t: b.key, engagement: 0, views: 0, published: 0, prevEngagement: 0, prevViews: 0, prevPublished: 0, followers: fol.series[i], prevFollowers: prevFol.series[i] }));
  for (const it of cur.items) { const i = idx(list, it.publishedAt); if (i >= 0) { series[i].engagement += it.engagement; series[i].views += it.views; } }
  for (const it of prev.items) { const i = idx(prevList, it.publishedAt); if (i >= 0) { series[i].prevEngagement += it.engagement; series[i].prevViews += it.views; } }
  for (const v of published) { const i = idx(list, v.publishedAt!); if (i >= 0) series[i].published++; }
  const prevPubList = await db.postVariant.findMany({ where: { post: { workspaceId: ws }, status: "published", publishedAt: { gte: pFrom, lte: pTo } }, select: { publishedAt: true } });
  for (const v of prevPubList) { const i = idx(prevList, v.publishedAt!); if (i >= 0) series[i].prevPublished++; }

  const views = cur.totals.views + cur.totals.impressions, pViews = prev.totals.views + prev.totals.impressions;
  const kpis = {
    engagement: { value: cur.totals.engagement, prev: prev.totals.engagement, change: pct(cur.totals.engagement, prev.totals.engagement), measured: cur.totals.posts > 0 },
    views: { value: views, prev: pViews, change: pct(views, pViews), measured: cur.totals.posts > 0 },
    reach: { value: cur.totals.reach, prev: prev.totals.reach, change: pct(cur.totals.reach, prev.totals.reach), measured: cur.totals.posts > 0 },
    followersGained: { value: fol.gained, prev: prevFol.gained, change: fol.gained != null && prevFol.gained != null ? pct(fol.gained, prevFol.gained) : null, measured: fol.gained != null },
    totalFollowers: accounts.reduce((a, x) => a + (x.followers ?? 0), 0),
    engagementRate: { value: cur.totals.engagementRate, prev: prev.totals.engagementRate },
    published: { value: published.length, prev: prevPublished, change: pct(published.length, prevPublished) },
  };

  // Per-platform summary (real numbers only)
  const platformIds = [...new Set(accounts.map((a) => a.platform))];
  // Same method as the KPI (last known count before the period → last in period), so totals reconcile.
  const gains = await Promise.all(platformIds.map((p) => followerSeries(ws, list, p).then((r) => [p, r.gained] as const)));
  const growthBy = new Map(gains.filter(([, g]) => g != null) as [string, number][]);
  const platforms = platformIds.map((p) => {
    const m = cur.byPlatform[p] ?? { posts: 0, views: 0, impressions: 0, reach: 0, engagement: 0 };
    const v = m.views + m.impressions;
    return { platform: p, accounts: accounts.filter((a) => a.platform === p).length, followers: accounts.filter((a) => a.platform === p).reduce((s, a) => s + (a.followers ?? 0), 0),
      followersGained: growthBy.has(p) ? growthBy.get(p)! : null, published: published.filter((x) => x.platform === p).length, measured: m.posts, views: v, reach: m.reach, engagement: m.engagement, engagementRate: v ? m.engagement / v : null,
      needsAttention: accounts.some((a) => a.platform === p && a.status !== "connected") };
  }).sort((a, b) => b.engagement - a.engagement || b.followers - a.followers);

  return { unit, series, kpis, platforms, top: cur.top.slice(0, 5), hasData: cur.hasData, alerts: await alerts(ws, o) };
}

export type Alert = { id: string; severity: "critical" | "warning" | "info"; kind: string; title: string; body?: string | null; link: string; at?: Date | null };

async function alerts(ws: string, o: { canApprove: boolean }): Promise<Alert[]> {
  const week = new Date(Date.now() - 7 * 86400000);
  const [failed, reauth, expiring, manual, review, emails, videos, overdue] = await Promise.all([
    db.postVariant.findMany({ where: { post: { workspaceId: ws }, status: "failed" }, orderBy: { updatedAt: "desc" }, take: 10, select: { id: true, platform: true, lastError: true, updatedAt: true, post: { select: { id: true, title: true } } } }),
    db.socialAccount.findMany({ where: { workspaceId: ws, status: { in: ["needs_reauth", "error"] } }, select: { id: true, platform: true, displayName: true, status: true, lastError: true, updatedAt: true } }),
    db.oAuthConnection.findMany({ where: { workspaceId: ws, status: "active", expiresAt: { lte: new Date(Date.now() + 2 * 86400000) } }, include: { accounts: { select: { displayName: true, platform: true } } } }),
    db.postVariant.findMany({ where: { post: { workspaceId: ws }, status: "manual_required" }, select: { id: true, platform: true, updatedAt: true, post: { select: { id: true, title: true } } }, take: 10 }),
    o.canApprove ? db.post.count({ where: { workspaceId: ws, status: "in_review" } }) : Promise.resolve(0),
    db.emailCampaign.findMany({ where: { workspaceId: ws, status: { in: ["failed", "partially_sent"] }, updatedAt: { gte: week } }, select: { id: true, name: true, lastError: true, status: true, updatedAt: true } }),
    db.videoProject.findMany({ where: { workspaceId: ws, status: "failed", updatedAt: { gte: week } }, select: { id: true, title: true, renderError: true, updatedAt: true } }),
    db.post.count({ where: { workspaceId: ws, status: "scheduled", scheduledAt: { lt: new Date(Date.now() - 15 * 60000) } } }),
  ]);
  const out: Alert[] = [];
  for (const a of reauth) out.push({ id: `acc-${a.id}`, severity: "critical", kind: "account", title: `${a.displayName}`, body: a.lastError, link: "/accounts", at: a.updatedAt });
  for (const c of expiring) for (const a of c.accounts) out.push({ id: `exp-${c.id}-${a.displayName}`, severity: "warning", kind: "token", title: a.displayName, body: c.expiresAt?.toISOString() ?? null, link: "/accounts", at: c.expiresAt });
  for (const f of failed) out.push({ id: `fail-${f.id}`, severity: "critical", kind: "publish_failed", title: f.post.title, body: `${f.platform}: ${f.lastError ?? ""}`, link: `/posts/${f.post.id}`, at: f.updatedAt });
  if (overdue) out.push({ id: "overdue", severity: "warning", kind: "overdue", title: String(overdue), link: "/posts?status=scheduled", at: null });
  for (const m of manual) out.push({ id: `man-${m.id}`, severity: "warning", kind: "manual", title: m.post.title, body: m.platform, link: `/posts/${m.post.id}`, at: m.updatedAt });
  if (review) out.push({ id: "review", severity: "info", kind: "review", title: String(review), link: "/posts?status=in_review", at: null });
  for (const e of emails) out.push({ id: `em-${e.id}`, severity: e.status === "failed" ? "critical" : "warning", kind: "email", title: e.name, body: e.lastError, link: "/email", at: e.updatedAt });
  for (const v of videos) out.push({ id: `vid-${v.id}`, severity: "warning", kind: "video", title: v.title, body: v.renderError?.slice(0, 200), link: `/video/${v.id}`, at: v.updatedAt });
  const rank = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
