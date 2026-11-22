import crypto from "node:crypto";
import { db } from "./db";
import { queue, QUEUES } from "./queue";
import { storage, signedMediaUrl } from "./storage";
import { notify } from "./notify";
import { PLATFORM_INFO, textLength, type Platform } from "./platforms";
import { getAccessToken, PUBLISHERS, markNeedsReauth, IntegrationError } from "./integrations";
import type { MediaInput } from "./integrations/types";

export type Check = { variantId: string; platform: string; level: "error" | "warning" | "ok"; code: string; message: string };

const postInclude = {
  variants: { include: { socialAccount: true, media: { include: { asset: true }, orderBy: { order: "asc" as const } } } },
  media: { include: { asset: true }, orderBy: { order: "asc" as const } },
};

/** Pre-publish validation — every check corresponds to a real platform rule. */
export async function validatePost(postId: string, workspaceId: string): Promise<Check[]> {
  const post = await db.post.findFirstOrThrow({ where: { id: postId, workspaceId }, include: postInclude });
  const out: Check[] = [];
  if (post.variants.length === 0) out.push({ variantId: "", platform: "-", level: "error", code: "no_platforms", message: "لم يتم اختيار أي منصة" });
  for (const v of post.variants) {
    const p = v.platform as Platform; const info = PLATFORM_INFO[p];
    const add = (level: Check["level"], code: string, message: string) => out.push({ variantId: v.id, platform: p, level, code, message });
    const media = (v.media.length ? v.media : post.media.filter((m) => !m.variantId)).map((m) => m.asset);
    const images = media.filter((m) => m.mimeType.startsWith("image/")); const videos = media.filter((m) => m.mimeType.startsWith("video/"));
    const fullText = [v.text, v.hashtags.join(" ")].filter(Boolean).join("\n\n");

    if (!v.socialAccount) { if (info.capabilities.publish.supported) add("error", "no_account", "لم يتم اختيار حساب للنشر"); }
    else if (v.socialAccount.status !== "connected") add("error", "account_disconnected", `الحساب ${v.socialAccount.displayName} غير متصل (${v.socialAccount.status}) — أعد الربط`);
    if (!info.capabilities.publish.supported) add("warning", "manual_only", info.capabilities.publish.note ?? "النشر عبر API غير متاح — سيتم تجهيز حزمة نشر يدوي");

    if (!v.text.trim() && v.threadParts.length === 0 && p !== "youtube") add("error", "empty_text", "النص فارغ");
    if (p === "x") {
      const parts = v.format === "thread" && v.threadParts.length ? v.threadParts : [fullText];
      parts.forEach((t, i) => { const l = textLength("x", t); if (l > 280) add("error", "too_long", `التغريدة ${i + 1} تتجاوز 280 حرفًا (${l})`); });
      if (v.format === "poll" && (v.pollOptions.length < 2 || v.pollOptions.length > 4)) add("error", "poll", "الاستطلاع يحتاج من 2 إلى 4 خيارات");
      if (v.pollOptions.some((o) => [...o].length > 25)) add("error", "poll_len", "خيار الاستطلاع لا يتجاوز 25 حرفًا");
      if (images.length > 4) add("error", "media_count", "X يسمح بحد أقصى 4 صور");
    } else if ([...fullText].length > info.textLimit) add("error", "too_long", `النص يتجاوز حد ${info.name} (${[...fullText].length}/${info.textLimit})`);

    if (info.hashtagLimit && v.hashtags.length > info.hashtagLimit) add("error", "hashtags", `عدد الهاشتاقات ${v.hashtags.length} يتجاوز ${info.hashtagLimit}`);
    if (v.hashtags.length === 0 && ["instagram", "tiktok"].includes(p)) add("warning", "no_hashtags", "لا توجد هاشتاقات — يُنصح بإضافة 3-10 هاشتاقات");
    const hasLink = /https?:\/\//.test(fullText);
    if (hasLink && ["instagram", "tiktok"].includes(p)) add("warning", "link", `الروابط في نص ${info.name} غير قابلة للنقر`);

    if (p === "instagram") {
      if (media.length === 0) add("error", "media_required", "Instagram يتطلب صورة أو فيديو");
      for (const m of images) {
        const r = m.width && m.height ? m.width / m.height : 1;
        if (v.format !== "story" && (r < 0.8 - 0.01 || r > 1.91 + 0.01)) add("error", "aspect", `نسبة أبعاد الصورة ${m.name} (${m.width}×${m.height}) خارج النطاق المسموح 4:5 إلى 1.91:1`);
        if (m.mimeType !== "image/jpeg" && m.mimeType !== "image/png") add("warning", "format", `يفضّل Instagram صيغة JPEG (${m.name})`);
      }
      if (v.format === "reel" && videos.length === 0) add("error", "video_required", "Reels تتطلب فيديو");
      if (v.format === "carousel" && media.length < 2) add("error", "carousel", "Carousel يحتاج 2 إلى 10 عناصر");
      if (media.length > 10) add("error", "carousel", "Carousel بحد أقصى 10 عناصر");
      for (const vid of videos) if ((vid.durationSec ?? 0) > 900) add("error", "duration", "مدة Reels القصوى 15 دقيقة");
    }
    if (p === "tiktok") {
      if (videos.length === 0) add("error", "video_required", "TikTok يتطلب فيديو");
      for (const vid of videos) {
        if ((vid.durationSec ?? 0) < 3) add("error", "duration", "مدة فيديو TikTok لا تقل عن 3 ثوانٍ");
        if (vid.width && vid.height && vid.width > vid.height) add("warning", "aspect", "يفضّل TikTok الفيديو العمودي 9:16");
      }
    }
    if (p === "youtube") {
      if (videos.length === 0) add("error", "video_required", "YouTube يتطلب فيديو");
      if (!v.title?.trim()) add("error", "title", "عنوان فيديو YouTube مطلوب");
      if ((v.title ?? "").length > 100) add("error", "title", "عنوان YouTube بحد أقصى 100 حرف");
      if (/[<>]/.test(v.title ?? "")) add("error", "title", "عنوان YouTube لا يقبل الرموز < >");
      if (v.format === "short") for (const vid of videos) {
        if ((vid.durationSec ?? 0) > 180) add("error", "duration", "Shorts بحد أقصى 3 دقائق");
        if (vid.width && vid.height && vid.width > vid.height) add("error", "aspect", "Shorts تتطلب فيديو عموديًا أو مربعًا");
      }
    }
    if (p === "gmail") {
      if (!v.title?.trim()) add("error", "subject", "عنوان الرسالة (Subject) مطلوب");
      const to = String((v.options as Record<string, unknown> | null)?.to ?? "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) add("error", "recipient", "أدخل بريد مستلم صالح (للحملات الجماعية استخدم قسم الحملات البريدية)");
    }
    if (p === "snapchat" && media.length === 0) add("warning", "media", "أضف صورة أو فيديو 9:16 لحزمة Snapchat");
    for (const m of media) if (m.platforms.length && !m.platforms.includes(p)) add("warning", "media_platform", `الملف ${m.name} مُعد لمنصات أخرى`);
    if (!out.some((c) => c.variantId === v.id && c.level !== "ok")) add("ok", "ok", "جاهز للنشر");
  }
  return out;
}

export async function schedulePost(postId: string, workspaceId: string, runAt: Date, userId?: string) {
  const checks = await validatePost(postId, workspaceId);
  const errors = checks.filter((c) => c.level === "error");
  if (errors.length) return { ok: false as const, checks };
  const post = await db.post.findFirstOrThrow({ where: { id: postId, workspaceId }, include: { variants: true } });
  await db.$transaction(async (tx) => {
    await tx.publishingJob.updateMany({ where: { variant: { postId }, status: "queued" }, data: { status: "cancelled" } });
    await tx.schedule.updateMany({ where: { postId, status: "active" }, data: { status: "cancelled" } });
    for (const v of post.variants) {
      if (v.status === "published") continue;
      await tx.publishingJob.create({ data: { workspaceId, variantId: v.id, runAt } });
      await tx.postVariant.update({ where: { id: v.id }, data: { status: "queued", lastError: null } });
    }
    await tx.schedule.create({ data: { postId, runAt } });
    await tx.post.update({ where: { id: postId }, data: { status: "scheduled", scheduledAt: runAt } });
  });
  if (runAt.getTime() <= Date.now() + 5000) await dispatchDueJobs();
  void userId;
  return { ok: true as const, checks };
}

export async function cancelSchedule(postId: string, workspaceId: string) {
  await db.post.findFirstOrThrow({ where: { id: postId, workspaceId } });
  await db.publishingJob.updateMany({ where: { variant: { postId }, status: "queued" }, data: { status: "cancelled" } });
  await db.schedule.updateMany({ where: { postId, status: "active" }, data: { status: "cancelled" } });
  await db.postVariant.updateMany({ where: { postId, status: "queued" }, data: { status: "pending" } });
  await db.post.update({ where: { id: postId }, data: { status: "approved", scheduledAt: null } });
}

/** Moves due jobs from DB into the BullMQ queue (DB is the source of truth; called every 30s by the worker). */
export async function dispatchDueJobs() {
  const due = await db.publishingJob.findMany({ where: { status: "queued", runAt: { lte: new Date() }, queueJobId: null }, take: 100 });
  for (const j of due) {
    const qj = await queue(QUEUES.publish).add("publish", { jobId: j.id }, { jobId: `pub-${j.id}-${j.attempts}`, attempts: 1 });
    await db.publishingJob.update({ where: { id: j.id }, data: { queueJobId: qj.id ?? null } });
  }
  return due.length;
}

async function log(jobId: string, socialAccountId: string | null, level: string, message: string, response?: unknown) {
  await db.publishingLog.create({ data: { jobId, socialAccountId, level, message: message.slice(0, 2000), response: response === undefined ? undefined : JSON.parse(JSON.stringify(response)) } });
}

/** Executes one publishing job. Marks "published" ONLY after the platform API confirms. */
export async function executeJob(jobId: string) {
  const job = await db.publishingJob.findUnique({ where: { id: jobId }, include: { variant: { include: { post: { include: { media: { include: { asset: true }, orderBy: { order: "asc" } } } }, media: { include: { asset: true }, orderBy: { order: "asc" } }, socialAccount: true } } } });
  if (!job || job.status === "cancelled" || job.status === "succeeded") return;
  const v = job.variant; const post = v.post;
  await db.publishingJob.update({ where: { id: job.id }, data: { status: "running", attempts: { increment: 1 } } });
  await db.postVariant.update({ where: { id: v.id }, data: { status: "publishing" } });
  await db.post.update({ where: { id: post.id }, data: { status: "publishing" } });
  await log(job.id, v.socialAccountId, "info", `بدء النشر على ${v.platform} (محاولة ${job.attempts + 1})`);

  try {
    if (!PLATFORM_INFO[v.platform as Platform].capabilities.publish.supported) throw new IntegrationError(v.platform, `MANUAL_REQUIRED: ${PLATFORM_INFO[v.platform as Platform].capabilities.publish.note}`);
    if (!v.socialAccountId) throw new IntegrationError(v.platform, "لا يوجد حساب محدد");
    const { token, account } = await getAccessToken(v.socialAccountId);
    const assets = (v.media.length ? v.media : post.media.filter((m) => !m.variantId));
    const media: MediaInput[] = [];
    for (const m of assets) {
      media.push({ assetId: m.assetId, mimeType: m.asset.mimeType, localPath: await storage().localPath(m.asset.storageKey), publicUrl: signedMediaUrl(m.assetId, 6 * 3600),
        sizeBytes: Number(m.asset.sizeBytes), width: m.asset.width, height: m.asset.height, durationSec: m.asset.durationSec, altText: m.altText });
      await db.mediaAsset.update({ where: { id: m.assetId }, data: { lastUsedAt: new Date() } });
    }
    const res = await PUBLISHERS[v.platform as Platform].publish({
      account: { externalId: account.externalId, username: account.username, meta: account.meta as Record<string, unknown> | null },
      accessToken: token, format: v.format, text: v.text, title: v.title, hashtags: v.hashtags, threadParts: v.threadParts, pollOptions: v.pollOptions,
      options: (v.options as Record<string, unknown>) ?? {}, media, scheduledAt: post.scheduledAt,
    });
    await db.$transaction([
      db.postVariant.update({ where: { id: v.id }, data: { status: "published", externalId: res.externalId, externalUrl: res.url ?? null, publishedAt: new Date(), lastError: null } }),
      db.publishingJob.update({ where: { id: job.id }, data: { status: "succeeded", lastError: null } }),
    ]);
    await log(job.id, v.socialAccountId, "info", `تم النشر وتأكيده من ${v.platform}: ${res.externalId}`, res.raw ?? res);
    await notify(job.workspaceId, { type: "publish.success", title: `تم نشر "${post.title}" على ${v.platform}`, link: `/posts/${post.id}` });
  } catch (e) {
    const err = e as IntegrationError;
    const manual = err.message.startsWith("MANUAL_REQUIRED");
    const retry = !manual && err.opts?.retryable && job.attempts + 1 < job.maxAttempts;
    if (err.opts?.needsReauth && v.socialAccount?.connectionId) await markNeedsReauth(v.socialAccount.connectionId, err.message);
    await log(job.id, v.socialAccountId, manual ? "warn" : "error", err.message, err.opts?.body);
    if (retry) {
      const delay = 60_000 * 2 ** job.attempts;
      await db.publishingJob.update({ where: { id: job.id }, data: { status: "queued", queueJobId: null, runAt: new Date(Date.now() + delay), lastError: err.message } });
      await db.postVariant.update({ where: { id: v.id }, data: { status: "queued", lastError: err.message } });
    } else {
      await db.publishingJob.update({ where: { id: job.id }, data: { status: manual ? "manual_required" : "failed", lastError: err.message } });
      await db.postVariant.update({ where: { id: v.id }, data: { status: manual ? "manual_required" : "failed", lastError: err.message.replace(/^MANUAL_REQUIRED:\s*/, "") } });
      if (manual) await notify(job.workspaceId, { type: "publish.manual", title: `"${post.title}" جاهز للنشر اليدوي على ${v.platform}`, link: `/posts/${post.id}` });
      else await notify(job.workspaceId, { type: "publish.failed", title: `فشل نشر "${post.title}" على ${v.platform}`, body: err.message.slice(0, 300), link: `/posts/${post.id}` });
    }
  }
  await refreshPostStatus(post.id);
}

export async function refreshPostStatus(postId: string) {
  const vs = await db.postVariant.findMany({ where: { postId } });
  const st = vs.map((v) => v.status);
  let status: string | null = null;
  if (st.some((s) => s === "publishing")) status = "publishing";
  else if (st.some((s) => s === "queued")) status = "scheduled";
  else if (st.length && st.every((s) => s === "published")) status = "published";
  else if (st.some((s) => s === "published")) status = "partially_published";
  else if (st.some((s) => s === "failed")) status = "failed";
  else if (st.some((s) => s === "manual_required")) status = "approved";
  if (status) await db.post.update({ where: { id: postId }, data: { status, ...(status === "published" || status === "partially_published" ? { publishedAt: new Date() } : {}) } });
}

/** Manual publishing confirmation (e.g. Snapchat) — user pastes the live URL. */
export async function confirmManual(variantId: string, workspaceId: string, url?: string) {
  const v = await db.postVariant.findFirstOrThrow({ where: { id: variantId, post: { workspaceId } } });
  await db.postVariant.update({ where: { id: v.id }, data: { status: "published", externalUrl: url || null, publishedAt: new Date(), lastError: null } });
  await db.publishingJob.updateMany({ where: { variantId, status: "manual_required" }, data: { status: "succeeded" } });
  await refreshPostStatus(v.postId);
}

export function unsubscribeToken(contactId: string) {
  return crypto.createHmac("sha256", process.env.ENCRYPTION_KEY!).update(`unsub.${contactId}`).digest("base64url").slice(0, 32);
}
