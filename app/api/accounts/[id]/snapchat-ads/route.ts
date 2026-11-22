import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getAccessToken } from "@/lib/integrations";
import { snapAdCampaigns, snapCreateCampaign, snapCampaignStats } from "@/lib/integrations/snapchat";
import { AppError, badRequest } from "@/lib/errors";

async function load(workspaceId: string, id: string) {
  const a = await db.socialAccount.findFirstOrThrow({ where: { id, workspaceId, platform: "snapchat" } });
  const adAccounts = ((a.meta as { adAccounts?: { id: string; name: string; currency: string }[] } | null)?.adAccounts) ?? [];
  return { a, adAccounts };
}
// GET ?adAccountId= → Snapchat Marketing API campaigns (+ lifetime stats)
export const GET = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("campaigns.manage"); const { id } = await params;
  const { adAccounts } = await load(c.workspaceId, id);
  const adAccountId = new URL(req.url).searchParams.get("adAccountId") ?? adAccounts[0]?.id;
  if (!adAccountId) return { adAccounts, campaigns: [] };
  try {
    const { token } = await getAccessToken(id);
    const campaigns = await snapAdCampaigns(token, adAccountId);
    const withStats = await Promise.all(campaigns.slice(0, 20).map(async (cp: { id: string }) => ({ ...cp, stats: await snapCampaignStats(token, cp.id).catch(() => null) })));
    return { adAccounts, adAccountId, campaigns: withStats };
  } catch (e) { throw new AppError(502, "platform_error", (e as Error).message); }
});
// POST → creates a PAUSED campaign (ads/creatives are then completed in Snapchat Ads Manager)
export const POST = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("campaigns.manage"); const { id } = await params;
  const b = await body(req, z.object({ adAccountId: z.string(), name: z.string().min(2).max(375), startTime: z.string().datetime(), dailyBudget: z.number().positive().optional() }));
  const { adAccounts } = await load(c.workspaceId, id);
  if (!adAccounts.some((x) => x.id === b.adAccountId)) throw badRequest("حساب إعلاني غير صالح");
  try {
    const { token } = await getAccessToken(id);
    const cp = await snapCreateCampaign(token, b.adAccountId, { name: b.name, startTime: b.startTime, dailyBudgetMicro: b.dailyBudget ? Math.round(b.dailyBudget * 1e6) : undefined });
    await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "snapchat.campaign_create", meta: { campaignId: cp.id } });
    return cp;
  } catch (e) { throw new AppError(502, "platform_error", (e as Error).message); }
});
