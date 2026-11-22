import { db } from "./db";
import { redis } from "./redis";
import { notify } from "./notify";
import { getAccessToken } from "./integrations";
import { buildMime, gmailSend } from "./integrations/google";
import { unsubscribeToken } from "./publishing";
import { sleep } from "./integrations/http";

import { esc } from "./email-render";
export { renderEmailHtml, type EmailBlocks } from "./email-render";

function personalize(html: string, c: { name: string | null; email: string; id: string }) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const url = `${base}/unsubscribe/${c.id}?t=${unsubscribeToken(c.id)}`;
  return {
    html: html.replace(/\{\{\s*name\s*\}\}/g, esc(c.name ?? "")).replace(/\{\{\s*email\s*\}\}/g, esc(c.email))
      .replace(/\{\{unsubscribe\}\}/g, `<a href="${url}" style="color:#9ca3af">إلغاء الاشتراك / Unsubscribe</a>`),
    unsubscribeUrl: url,
  };
}

/** Sends an email campaign through Gmail API, respecting a per-account daily cap and pacing. */
export async function sendEmailCampaign(campaignId: string) {
  const c = await db.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!c || !["scheduled", "sending"].includes(c.status)) return;
  if (!c.socialAccountId || !c.groupId) { await db.emailCampaign.update({ where: { id: c.id }, data: { status: "failed", lastError: "حدد حساب Gmail ومجموعة مستلمين" } }); return; }
  await db.emailCampaign.update({ where: { id: c.id }, data: { status: "sending" } });
  const ws = await db.setting.findUnique({ where: { workspaceId_key: { workspaceId: c.workspaceId, key: "email.dailyCap" } } });
  const dailyCap = Number(ws?.value ?? 400);
  const contacts = await db.contact.findMany({ where: { workspaceId: c.workspaceId, subscribed: true, groups: { some: { groupId: c.groupId } } } });
  const sentKey = (id: string) => `email:sent:${c.id}:${id}`;
  let sent = c.sentCount, failed = c.failedCount; let lastError: string | null = null;
  for (const ct of contacts) {
    if (await redis().get(sentKey(ct.id))) continue;
    const dayKey = `email:day:${c.socialAccountId}:${new Date().toISOString().slice(0, 10)}`;
    const today = Number(await redis().get(dayKey) ?? 0);
    if (today >= dailyCap) {
      lastError = `تم الوصول إلى الحد اليومي للإرسال (${dailyCap}). سيُستكمل الإرسال غدًا.`;
      await db.emailCampaign.update({ where: { id: c.id }, data: { status: "scheduled", scheduledAt: new Date(Date.now() + 24 * 3600 * 1000), sentCount: sent, failedCount: failed, lastError } });
      return;
    }
    try {
      const { token, account } = await getAccessToken(c.socialAccountId);
      const p = personalize(c.html, ct);
      await gmailSend(token, buildMime({ from: account.externalId, to: ct.name ? `"${ct.name.replace(/"/g, "")}" <${ct.email}>` : ct.email, subject: c.subject.replace(/\{\{\s*name\s*\}\}/g, ct.name ?? ""), html: p.html, listUnsubscribe: p.unsubscribeUrl }));
      await redis().set(sentKey(ct.id), "1", "EX", 60 * 60 * 24 * 30);
      await redis().incr(dayKey); await redis().expire(dayKey, 60 * 60 * 26);
      sent++;
    } catch (e) {
      failed++; lastError = (e as Error).message;
      if ((e as { opts?: { needsReauth?: boolean } }).opts?.needsReauth) break;
    }
    if ((sent + failed) % 10 === 0) await db.emailCampaign.update({ where: { id: c.id }, data: { sentCount: sent, failedCount: failed } });
    await sleep(1200);
  }
  const status = failed === 0 ? "sent" : sent === 0 ? "failed" : "partially_sent";
  await db.emailCampaign.update({ where: { id: c.id }, data: { status, sentAt: new Date(), sentCount: sent, failedCount: failed, lastError } });
  await notify(c.workspaceId, { type: status === "failed" ? "email.failed" : "email.sent", title: `الحملة البريدية "${c.name}": أُرسلت ${sent}، فشلت ${failed}`, body: lastError ?? undefined, link: "/email" });
}
