import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";
import type { CampaignPlan } from "@/lib/ai/service";
import { PLATFORMS } from "@/lib/platforms";

const FORMATS: Record<string, string[]> = { instagram: ["post", "carousel", "reel", "story"], x: ["post", "thread", "poll"], tiktok: ["video"], youtube: ["video", "short"], snapchat: ["story"], gmail: ["email"] };

// Turns the AI plan into draft posts placed on the calendar at their planned dates (not scheduled until reviewed).
export const POST = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("content.create"); const { id } = await params;
  const camp = await db.campaign.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  const plan = camp.plan as CampaignPlan | null;
  if (!plan?.weeks?.length) throw badRequest("أنشئ خطة الحملة أولًا");
  const start = camp.startDate ?? new Date();
  const accounts = await db.socialAccount.findMany({ where: { workspaceId: c.workspaceId, status: "connected" } });
  let created = 0;
  for (const w of plan.weeks) for (const p of w.posts) {
    if (!PLATFORMS.includes(p.platform as never)) continue;
    const [hh, mm] = (p.time || "19:00").split(":").map(Number);
    const at = new Date(start); at.setDate(at.getDate() + Math.max(0, Math.round(p.dayOffset))); at.setHours(hh || 19, mm || 0, 0, 0);
    const format = FORMATS[p.platform].includes(p.format) ? p.format : FORMATS[p.platform][0];
    const post = await db.post.create({ data: { workspaceId: c.workspaceId, authorId: c.user.id, title: p.title.slice(0, 300), body: p.text, status: "draft", scheduledAt: at, contentType: p.contentType,
      variants: { create: [{ platform: p.platform, format, text: p.text, title: ["youtube", "gmail"].includes(p.platform) ? p.title.slice(0, 100) : null, hashtags: p.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)),
        threadParts: format === "thread" ? p.text.split(/\n\n+/).slice(0, 10) : [], socialAccountId: accounts.find((a) => a.platform === p.platform)?.id ?? null, options: { visualIdea: p.visualIdea } }] },
      campaignPosts: { create: { campaignId: id } } } });
    await db.contentIdea.create({ data: { workspaceId: c.workspaceId, campaignId: id, title: p.visualIdea.slice(0, 200) || p.title, body: `فكرة بصرية لمنشور: ${p.title}`, tags: ["visual", p.platform], status: "in_progress", createdById: c.user.id } }).catch(() => null);
    void post; created++;
  }
  await db.campaign.update({ where: { id }, data: { status: camp.status === "planning" ? "active" : camp.status } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "campaign.apply_plan", entityType: "Campaign", entityId: id, meta: { created } });
  return { created };
});
