import { db } from "./db";
import { getAccessToken, PUBLISHERS, IntegrationError } from "./integrations";
import type { Platform } from "./platforms";

/** Pulls real metrics from platform APIs and stores time-series snapshots. */
export async function syncAccount(socialAccountId: string) {
  const acc = await db.socialAccount.findUniqueOrThrow({ where: { id: socialAccountId } });
  const pub = PUBLISHERS[acc.platform as Platform];
  const errors: string[] = [];
  try {
    const { token } = await getAccessToken(acc.id);
    const ref = { externalId: acc.externalId, meta: acc.meta as Record<string, unknown> | null };
    if (pub.accountMetrics) {
      const m = await pub.accountMetrics({ accessToken: token, account: ref });
      await db.analyticsSnapshot.create({ data: { workspaceId: acc.workspaceId, socialAccountId: acc.id, scope: "account", followers: m.followers, views: m.views, likes: m.likes, raw: (m.raw ?? undefined) as object | undefined } });
      if (m.followers !== undefined) await db.socialAccount.update({ where: { id: acc.id }, data: { followers: m.followers } });
    }
    const variants = await db.postVariant.findMany({ where: { socialAccountId: acc.id, status: "published", externalId: { not: null }, publishedAt: { gte: new Date(Date.now() - 180 * 86400000) } } });
    if (pub.postMetrics && variants.length) {
      const res = await pub.postMetrics({ accessToken: token, account: ref, externalIds: variants.map((v) => v.externalId!) });
      for (const v of variants) {
        const m = res[v.externalId!]; if (!m) continue;
        await db.analyticsSnapshot.create({ data: { workspaceId: acc.workspaceId, socialAccountId: acc.id, variantId: v.id, scope: "post", externalPostId: v.externalId, impressions: m.impressions, reach: m.reach, views: m.views, likes: m.likes, comments: m.comments, shares: m.shares, saves: m.saves, raw: (m.raw ?? undefined) as object | undefined } });
      }
    }
    if (pub.fetchComments) {
      const comments = await pub.fetchComments({ accessToken: token, account: ref, externalPostIds: variants.map((v) => v.externalId!) });
      for (const c of comments) {
        await db.comment.upsert({ where: { socialAccountId_externalId: { socialAccountId: acc.id, externalId: c.externalId } }, update: {},
          create: { workspaceId: acc.workspaceId, socialAccountId: acc.id, externalId: c.externalId, externalPostId: c.externalPostId, authorName: c.authorName, authorHandle: c.authorHandle, text: c.text, postedAt: c.postedAt } });
      }
    }
    await db.socialAccount.update({ where: { id: acc.id }, data: { lastSyncAt: new Date(), lastError: null, ...(acc.status === "error" ? { status: "connected" } : {}) } });
  } catch (e) {
    const msg = (e as Error).message; errors.push(msg);
    await db.socialAccount.update({ where: { id: acc.id }, data: { lastSyncAt: new Date(), lastError: msg.slice(0, 1000), ...(e instanceof IntegrationError && e.opts.needsReauth ? { status: "needs_reauth" } : {}) } });
  }
  return { ok: errors.length === 0, errors };
}

/** Aggregates stored snapshots for a period (only real data — returns empty series if nothing synced). */
export async function analyticsSummary(workspaceId: string, from: Date, to: Date, platform?: string) {
  const accounts = await db.socialAccount.findMany({ where: { workspaceId, status: { not: "disconnected" }, ...(platform ? { platform } : {}) } });
  const ids = accounts.map((a) => a.id);
  const postSnaps = await db.analyticsSnapshot.findMany({
    where: { socialAccountId: { in: ids }, scope: "post", variant: { publishedAt: { gte: from, lte: to } } },
    orderBy: { capturedAt: "desc" },
    include: { variant: { select: { id: true, platform: true, text: true, title: true, externalUrl: true, publishedAt: true, format: true, post: { select: { id: true, title: true, contentType: true } } } } },
  });
  // latest snapshot per variant
  const latest = new Map<string, (typeof postSnaps)[number]>();
  for (const s of postSnaps) if (s.variantId && !latest.has(s.variantId)) latest.set(s.variantId, s);
  const posts = [...latest.values()];
  const sum = (k: "views" | "likes" | "comments" | "shares" | "saves" | "reach" | "impressions", arr = posts) => arr.reduce((a, s) => a + (s[k] ?? 0), 0);
  const engagement = (s: (typeof posts)[number]) => (s.likes ?? 0) + (s.comments ?? 0) + (s.shares ?? 0) + (s.saves ?? 0);
  const byPlatform = Object.fromEntries([...new Set(accounts.map((a) => a.platform))].map((p) => {
    const ps = posts.filter((s) => s.variant?.platform === p);
    return [p, { posts: ps.length, views: sum("views", ps), reach: sum("reach", ps), impressions: sum("impressions", ps), likes: sum("likes", ps), comments: sum("comments", ps), shares: sum("shares", ps), saves: sum("saves", ps), engagement: ps.reduce((a, s) => a + engagement(s), 0) }];
  }));
  const byType: Record<string, { posts: number; engagement: number }> = {};
  for (const s of posts) { const k = s.variant?.post.contentType ?? "unspecified"; byType[k] ??= { posts: 0, engagement: 0 }; byType[k].posts++; byType[k].engagement += engagement(s); }
  const daily: Record<string, { date: string; engagement: number; views: number; posts: number }> = {};
  for (const s of posts) { const d = s.variant!.publishedAt!.toISOString().slice(0, 10); daily[d] ??= { date: d, engagement: 0, views: 0, posts: 0 }; daily[d].engagement += engagement(s); daily[d].views += (s.views ?? 0) + (s.impressions ?? 0); daily[d].posts++; }
  const followerSnaps = await db.analyticsSnapshot.findMany({ where: { socialAccountId: { in: ids }, scope: "account", capturedAt: { gte: from, lte: to } }, orderBy: { capturedAt: "asc" }, include: { socialAccount: { select: { platform: true, displayName: true } } } });
  const growth = accounts.map((a) => {
    const s = followerSnaps.filter((f) => f.socialAccountId === a.id && f.followers != null);
    return { accountId: a.id, platform: a.platform, name: a.displayName, start: s[0]?.followers ?? null, end: s[s.length - 1]?.followers ?? a.followers ?? null, series: s.map((x) => ({ at: x.capturedAt, followers: x.followers })) };
  });
  const top = posts.sort((a, b) => engagement(b) - engagement(a)).slice(0, 10).map((s) => ({ variantId: s.variantId, postId: s.variant?.post.id, platform: s.variant?.platform, title: s.variant?.post.title, url: s.variant?.externalUrl, publishedAt: s.variant?.publishedAt, views: (s.views ?? 0) || (s.impressions ?? 0), likes: s.likes, comments: s.comments, shares: s.shares, saves: s.saves, engagement: engagement(s) }));
  const totalEng = posts.reduce((a, s) => a + engagement(s), 0);
  const totalViews = sum("views") + sum("impressions");
  return {
    totals: { posts: posts.length, views: sum("views"), impressions: sum("impressions"), reach: sum("reach"), likes: sum("likes"), comments: sum("comments"), shares: sum("shares"), saves: sum("saves"), engagement: totalEng, engagementRate: totalViews ? totalEng / totalViews : null },
    byPlatform, byType, daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)), growth, top,
    hasData: posts.length > 0 || followerSnaps.length > 0,
    items: posts.map((s) => ({ platform: s.variant!.platform, publishedAt: s.variant!.publishedAt!, engagement: engagement(s), views: (s.views ?? 0) + (s.impressions ?? 0), reach: s.reach ?? 0 })),
  };
}

/** Best posting hours derived from the workspace's own published posts (engagement by hour). */
export async function bestTimes(workspaceId: string, platform?: string) {
  const snaps = await db.analyticsSnapshot.findMany({ where: { workspaceId, scope: "post", ...(platform ? { variant: { platform } } : {}) }, orderBy: { capturedAt: "desc" }, include: { variant: { select: { id: true, publishedAt: true } } } });
  const seen = new Set<string>(); const byHour: Record<number, { n: number; eng: number }> = {};
  for (const s of snaps) {
    if (!s.variant?.publishedAt || seen.has(s.variant.id)) continue; seen.add(s.variant.id);
    const h = s.variant.publishedAt.getUTCHours(); byHour[h] ??= { n: 0, eng: 0 };
    byHour[h].n++; byHour[h].eng += (s.likes ?? 0) + (s.comments ?? 0) + (s.shares ?? 0) + (s.saves ?? 0);
  }
  const ranked = Object.entries(byHour).map(([h, v]) => ({ hourUtc: Number(h), posts: v.n, avgEngagement: v.eng / v.n })).sort((a, b) => b.avgEngagement - a.avgEngagement);
  return { sampleSize: seen.size, ranked, sufficient: seen.size >= 10 };
}
