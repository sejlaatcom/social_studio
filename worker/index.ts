/* Background worker: publishing, scheduling, video rendering, analytics sync, email campaigns, token refresh. */
import { Worker } from "bullmq";
import { db } from "../lib/db";
import { redis } from "../lib/redis";
import { queue, QUEUES } from "../lib/queue";
import { dispatchDueJobs, executeJob } from "../lib/publishing";
import { renderVideo, generateVoiceover } from "../lib/video";
import { syncAccount } from "../lib/analytics";
import { sendEmailCampaign } from "../lib/email";
import { notify } from "../lib/notify";
import { PROVIDERS, getAppCreds } from "../lib/integrations";
import { decrypt, encrypt } from "../lib/crypto";
import type { ProviderId } from "../lib/integrations/types";

const connection = redis();
const log = (...a: unknown[]) => console.log(new Date().toISOString(), "[worker]", ...a);

new Worker(QUEUES.publish, async (j) => { await executeJob(j.data.jobId); }, { connection, concurrency: 4 });
new Worker(QUEUES.video, async (j) => {
  if (j.name === "voiceover") await generateVoiceover(j.data.videoId, j.data.userId);
  if (j.name === "render") await renderVideo(j.data.videoId);
}, { connection, concurrency: 1 });
new Worker(QUEUES.analytics, async (j) => syncAccount(j.data.socialAccountId), { connection, concurrency: 2 });
new Worker(QUEUES.email, async (j) => sendEmailCampaign(j.data.campaignId), { connection, concurrency: 1 });

async function once(key: string, ttlSec: number) {
  return (await redis().set(`once:${key}`, "1", "EX", ttlSec, "NX")) === "OK";
}

async function tick() {
  try {
    const n = await dispatchDueJobs();
    if (n) log(`dispatched ${n} publishing jobs`);

    // Email campaigns due
    const emails = await db.emailCampaign.findMany({ where: { status: "scheduled", scheduledAt: { lte: new Date() } } });
    for (const e of emails) if (await once(`email:${e.id}:${e.scheduledAt?.getTime()}`, 3600)) await queue(QUEUES.email).add("send", { campaignId: e.id });

    // Upcoming publish reminders (30 min before)
    const soon = await db.post.findMany({ where: { status: "scheduled", scheduledAt: { gte: new Date(), lte: new Date(Date.now() + 30 * 60000) } } });
    for (const p of soon) if (await once(`remind:${p.id}:${p.scheduledAt?.getTime()}`, 7200))
      await notify(p.workspaceId, { type: "publish.upcoming", title: `اقترب موعد نشر "${p.title}"`, link: `/posts/${p.id}` });

    // Manual platforms (Snapchat) reminders at scheduled time
    const manual = await db.postVariant.findMany({ where: { status: "manual_required", post: { scheduledAt: { lte: new Date() } } }, include: { post: true } });
    for (const v of manual) if (await once(`manual:${v.id}`, 86400 * 7))
      await notify(v.post.workspaceId, { type: "publish.manual", title: `حان موعد النشر اليدوي لـ "${v.post.title}" على ${v.platform}`, link: `/posts/${v.postId}` });

    // Ended campaigns
    const ended = await db.campaign.findMany({ where: { status: "active", endDate: { lt: new Date() } } });
    for (const c of ended) {
      await db.campaign.update({ where: { id: c.id }, data: { status: "completed" } });
      await notify(c.workspaceId, { type: "campaign.ended", title: `انتهت الحملة "${c.name}"`, link: `/campaigns/${c.id}` });
    }
  } catch (e) { log("tick error", e); }
}

async function hourly() {
  try {
    // Proactively refresh tokens expiring within 3 days (Instagram long-lived tokens, Google, X, TikTok)
    const expiring = await db.oAuthConnection.findMany({ where: { status: "active", expiresAt: { lte: new Date(Date.now() + 3 * 86400000) } } });
    for (const c of expiring) {
      const app = await getAppCreds(c.workspaceId, c.provider as ProviderId); if (!app) continue;
      try {
        const t = await PROVIDERS[c.provider as ProviderId].refresh({ app, refreshToken: c.refreshTokenEnc ? decrypt(c.refreshTokenEnc) : null, accessToken: decrypt(c.accessTokenEnc) });
        await db.oAuthConnection.update({ where: { id: c.id }, data: { accessTokenEnc: encrypt(t.accessToken), refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken) : c.refreshTokenEnc, expiresAt: t.expiresIn ? new Date(Date.now() + t.expiresIn * 1000) : null, lastRefreshedAt: new Date() } });
      } catch (e) {
        if (c.expiresAt && c.expiresAt < new Date()) {
          await db.oAuthConnection.update({ where: { id: c.id }, data: { status: "expired", lastError: (e as Error).message } });
          await db.socialAccount.updateMany({ where: { connectionId: c.id }, data: { status: "needs_reauth" } });
          await notify(c.workspaceId, { type: "account.reauth", title: `انتهت صلاحية اتصال ${c.provider} — يلزم إعادة الربط`, link: "/accounts" });
        }
      }
    }
    // Analytics sync every 6h per account
    const accounts = await db.socialAccount.findMany({ where: { status: "connected" } });
    for (const a of accounts) if (!a.lastSyncAt || Date.now() - a.lastSyncAt.getTime() > 6 * 3600 * 1000) await queue(QUEUES.analytics).add("sync", { socialAccountId: a.id }, { jobId: `sync-${a.id}-${Math.floor(Date.now() / 3600000)}` });
    // Housekeeping
    await db.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch (e) { log("hourly error", e); }
}

log("started");
void tick(); void hourly();
setInterval(tick, 30_000);
setInterval(hourly, 3600_000);
process.on("SIGTERM", () => process.exit(0));
