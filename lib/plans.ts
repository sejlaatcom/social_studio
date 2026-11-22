import { db } from "./db";
import { limitReached } from "./errors";

export type PlanLimits = {
  accounts: number; postsPerMonth: number; users: number; aiTextRequests: number;
  aiImages: number; videos: number; storageMb: number; campaigns: number;
};
const UNLIMITED = -1;

export const DEFAULT_PLANS: { key: string; name: string; priceMonthly: number; limits: PlanLimits }[] = [
  { key: "free", name: "Free", priceMonthly: 0, limits: { accounts: 3, postsPerMonth: 30, users: 1, aiTextRequests: 50, aiImages: 10, videos: 2, storageMb: 1024, campaigns: 2 } },
  { key: "basic", name: "Basic", priceMonthly: 19, limits: { accounts: 6, postsPerMonth: 150, users: 3, aiTextRequests: 500, aiImages: 100, videos: 10, storageMb: 10240, campaigns: 10 } },
  { key: "pro", name: "Pro", priceMonthly: 49, limits: { accounts: 15, postsPerMonth: 1000, users: 10, aiTextRequests: 3000, aiImages: 500, videos: 50, storageMb: 51200, campaigns: 50 } },
  { key: "business", name: "Business", priceMonthly: 129, limits: { accounts: 50, postsPerMonth: 5000, users: 30, aiTextRequests: 15000, aiImages: 2000, videos: 200, storageMb: 204800, campaigns: 200 } },
  { key: "enterprise", name: "Enterprise", priceMonthly: 0, limits: { accounts: UNLIMITED, postsPerMonth: UNLIMITED, users: UNLIMITED, aiTextRequests: UNLIMITED, aiImages: UNLIMITED, videos: UNLIMITED, storageMb: UNLIMITED, campaigns: UNLIMITED } },
];

export async function getLimits(workspaceId: string): Promise<PlanLimits | null> {
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, include: { organization: { include: { plan: true } } } });
  return (ws?.organization.plan?.limits as PlanLimits | undefined) ?? null;
}

const period = () => new Date().toISOString().slice(0, 7);

export async function usage(workspaceId: string) {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const [accounts, posts, users, storage, campaigns, ai] = await Promise.all([
    db.socialAccount.count({ where: { workspaceId, status: { not: "disconnected" } } }),
    db.post.count({ where: { workspaceId, createdAt: { gte: monthStart } } }),
    db.membership.count({ where: { workspace: { organizationId: ws.organizationId } } }),
    db.mediaAsset.aggregate({ where: { workspaceId }, _sum: { sizeBytes: true } }),
    db.campaign.count({ where: { workspaceId } }),
    db.aIUsage.findMany({ where: { workspaceId, period: period() } }),
  ]);
  const aiCount = (k: string) => ai.find((a) => a.kind === k)?.count ?? 0;
  return {
    accounts, postsPerMonth: posts, users, campaigns,
    storageMb: Number(storage._sum.sizeBytes ?? 0n) / 1024 / 1024,
    aiTextRequests: aiCount("text") + aiCount("chat") + aiCount("analysis") + aiCount("video_script"),
    aiImages: aiCount("image"), videos: aiCount("video_render"),
  } satisfies Record<keyof PlanLimits, number>;
}

/** Throws a 402 error when the action would exceed the organization's plan. */
export async function checkLimit(workspaceId: string, key: keyof PlanLimits, adding = 1) {
  const limits = await getLimits(workspaceId);
  if (!limits || limits[key] === UNLIMITED) return;
  const u = await usage(workspaceId);
  if (u[key] + adding > limits[key]) throw limitReached(`تم الوصول إلى حد الخطة (${key}: ${limits[key]}). قم بترقية الخطة للمتابعة.`);
}

export async function trackAIUsage(workspaceId: string, kind: string, inputTokens = 0, outputTokens = 0) {
  await db.aIUsage.upsert({
    where: { workspaceId_period_kind: { workspaceId, period: period(), kind } },
    create: { workspaceId, period: period(), kind, count: 1, inputTokens, outputTokens },
    update: { count: { increment: 1 }, inputTokens: { increment: inputTokens }, outputTokens: { increment: outputTokens } },
  });
}
