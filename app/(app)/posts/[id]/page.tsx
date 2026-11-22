"use client";
import { use, useState } from "react";
import Link from "next/link";
import { Send, ExternalLink, Copy, Download, CheckCircle2, XCircle, RefreshCw, CalendarX, ClipboardCheck, MessageSquare } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Composer, type Draft } from "@/components/composer";
import { Card, PageHeader, SkeletonList, ErrorBox, Button, Modal, Field, Badge, useToast } from "@/components/ui";
import { PlatformIcon, PLATFORM_LABEL } from "@/components/platform-icon";
import { StatusBadge } from "@/components/status";
import { fileUrl } from "@/components/media";
import { usePerms } from "@/components/shell";
import { api } from "@/lib/client";

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT(); const locale = useLocale(); const toast = useToast(); const can = usePerms();
  const { data: p, loading, error, reload } = useApi<any>(`/api/posts/${id}`);
  const [manual, setManual] = useState<any>(null); const [review, setReview] = useState<null | "approve" | "changes_requested">(null); const [note, setNote] = useState("");
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !p) return <SkeletonList rows={6} />;
  const draft: Draft = {
    id: p.id, title: p.title, body: p.body, status: p.status, contentType: p.contentType, campaignId: p.campaignPosts[0]?.campaign.id ?? null,
    media: p.media.map((m: any) => ({ asset: m.asset, altText: m.altText })),
    variants: p.variants.map((v: any) => ({ id: v.id, platform: v.platform, socialAccountId: v.socialAccountId, format: v.format, text: v.text, title: v.title, hashtags: v.hashtags, threadParts: v.threadParts, pollOptions: v.pollOptions, options: v.options ?? {}, status: v.status, media: v.media.length ? v.media.map((m: any) => ({ asset: m.asset, altText: m.altText })) : undefined })),
  };
  const anyPublishState = p.variants.some((v: any) => v.status !== "pending");
  async function decide(action: string) { try { await api(`/api/posts/${id}/approval`, { body: { action, note } }); setReview(null); setNote(""); toast.success(t("تم", "Done")); reload(true); } catch (e) { toast.error(e); } }
  async function unschedule() { try { await api(`/api/posts/${id}/schedule`, { method: "DELETE" }); toast.success(t("أُلغيت الجدولة", "Unscheduled")); reload(true); } catch (e) { toast.error(e); } }

  return <div>
    <PageHeader icon={<Send />} title={p.title} subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={p.status} />{p.scheduledAt && <span>{t("موعد النشر", "Scheduled for")}: {new Date(p.scheduledAt).toLocaleString(locale, { dateStyle: "full", timeStyle: "short" })}</span>}{p.author && <span>· {p.author.name}</span>}</span>}
      actions={<>
        {p.status === "scheduled" && can("content.publish") && <Button variant="outline" onClick={unschedule}><CalendarX className="h-4 w-4" />{t("إلغاء الجدولة", "Unschedule")}</Button>}
        {p.status === "in_review" && can("content.approve") && <><Button onClick={() => setReview("approve")}><CheckCircle2 className="h-4 w-4" />{t("اعتماد", "Approve")}</Button><Button variant="outline" onClick={() => setReview("changes_requested")}><XCircle className="h-4 w-4" />{t("طلب تعديلات", "Request changes")}</Button></>}
        <Button variant="ghost" onClick={() => reload(true)}><RefreshCw className="h-4 w-4" /></Button>
      </>} />

    {anyPublishState && <Card className="mb-4 p-5">
      <h3 className="mb-3 font-semibold">{t("حالة النشر لكل منصة", "Publishing status per platform")}</h3>
      <div className="space-y-3">{p.variants.map((v: any) => {
        const m = v.analytics[0];
        return <div key={v.id} className="rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center gap-3"><PlatformIcon platform={v.platform} size={24} /><span className="font-medium">{v.socialAccount?.displayName ?? t(PLATFORM_LABEL[v.platform][0], PLATFORM_LABEL[v.platform][1])}</span><StatusBadge status={v.status} />
            {v.externalUrl && <a href={v.externalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary"><ExternalLink className="h-3 w-3" />{t("عرض على المنصة", "View on platform")}</a>}
            {v.publishedAt && <span className="text-xs text-subtle">{new Date(v.publishedAt).toLocaleString(locale)}</span>}
            <div className="flex-1" />{v.status === "manual_required" && <Button onClick={() => setManual(v)}><ClipboardCheck className="h-4 w-4" />{t("حزمة النشر اليدوي", "Manual publishing kit")}</Button>}
          </div>
          {m && <div className="mt-2 flex flex-wrap gap-3 text-xs text-subtle">{[["views", t("مشاهدات", "views")], ["impressions", t("ظهور", "impressions")], ["reach", t("وصول", "reach")], ["likes", t("إعجابات", "likes")], ["comments", t("تعليقات", "comments")], ["shares", t("مشاركات", "shares")], ["saves", t("حفظ", "saves")]].filter(([k]) => m[k] != null).map(([k, l]) => <span key={k}><b className="text-fg">{m[k].toLocaleString()}</b> {l}</span>)}<span>· {t("آخر قياس", "measured")} {new Date(m.capturedAt).toLocaleString(locale)}</span></div>}
          {v.lastError && <p className={`mt-2 rounded-lg p-2 text-xs ${v.status === "manual_required" ? "bg-warning/10 text-warning" : v.status === "queued" ? "bg-muted text-subtle" : "bg-danger/5 text-danger"}`}>{v.status === "queued" ? t("ستُعاد المحاولة تلقائيًا: ", "Will retry automatically: ") : ""}{v.lastError}</p>}
          {v.jobs[0]?.logs.length > 0 && <details className="mt-2 text-xs"><summary className="cursor-pointer text-subtle">{t("سجل العمليات", "Operation log")}</summary><ol className="mt-2 space-y-1 border-s-2 border-border ps-3">{v.jobs.flatMap((j: any) => j.logs).map((l: any) => <li key={l.id} className={l.level === "error" ? "text-danger" : l.level === "warn" ? "text-warning" : "text-subtle"}><span dir="ltr">{new Date(l.createdAt).toLocaleTimeString(locale)}</span> — {l.message}</li>)}</ol></details>}
        </div>;
      })}</div>
    </Card>}

    {p.approvals.length > 0 && <Card className="mb-4 p-5"><h3 className="mb-2 flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" />{t("سير المراجعة", "Review history")}</h3>
      <div className="space-y-2 text-sm">{p.approvals.map((a: any) => <div key={a.id} className="flex flex-wrap items-center gap-2"><Badge tone={a.status === "approved" ? "success" : a.status === "pending" ? "warning" : "danger"}>{a.status}</Badge><span>{a.reviewer?.name ?? "—"}</span>{a.note && <span className="text-subtle">“{a.note}”</span>}<span className="text-xs text-subtle">{new Date(a.decidedAt ?? a.createdAt).toLocaleString(locale)}</span></div>)}</div></Card>}

    <Composer key={p.updatedAt} initial={draft} />

    {manual && <Modal open onClose={() => setManual(null)} size="lg" title={<span className="flex items-center gap-2"><PlatformIcon platform={manual.platform} />{t("حزمة النشر اليدوي", "Manual publishing kit")}</span>}>
      <ManualKit v={manual} postMedia={p.media} onDone={() => { setManual(null); reload(true); }} postId={id} />
    </Modal>}
    <Modal open={!!review} onClose={() => setReview(null)} size="sm" title={review === "approve" ? t("اعتماد المنشور", "Approve post") : t("طلب تعديلات", "Request changes")} footer={<Button onClick={() => decide(review!)}>{t("تأكيد", "Confirm")}</Button>}>
      <Field label={t("ملاحظة (اختياري)", "Note (optional)")}><textarea className="input min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  </div>;
}

function ManualKit({ v, postMedia, postId, onDone }: { v: any; postMedia: any[]; postId: string; onDone: () => void }) {
  const t = useT(); const toast = useToast(); const [url, setUrl] = useState(""); const [busy, setBusy] = useState(false);
  const media = v.media.length ? v.media : postMedia;
  const text = [v.text, v.hashtags.join(" ")].filter(Boolean).join("\n\n");
  const steps: Record<string, [string, string][]> = {
    snapchat: [["افتح تطبيق Snapchat على جوالك واذهب إلى الكاميرا.", "Open Snapchat on your phone and go to the camera."], ["اضغط على أيقونة الذكريات/المعرض واختر الملف الذي نزّلته (9:16).", "Tap Memories/Camera Roll and pick the downloaded 9:16 file."], ["أضف النص أو الملصقات، ثم اختر 'قصتي' أو 'Spotlight' أو ملفك العام.", "Add text/stickers, then choose My Story, Spotlight or your Public Profile."], ["بعد النشر انسخ رابط المحتوى (إن توفر) والصقه أدناه لتأكيد النشر.", "After posting, paste the content link (if available) below to confirm."]],
  };
  const list = steps[v.platform] ?? [["انشر المحتوى يدويًا على المنصة باستخدام النص والملفات أدناه.", "Post manually using the text and files below."], ["ثم أكّد النشر هنا.", "Then confirm here."]];
  async function confirm() { setBusy(true); try { await api(`/api/posts/${postId}/manual`, { body: { variantId: v.id, url } }); toast.success(t("تم تأكيد النشر", "Publication confirmed")); onDone(); } catch (e) { toast.error(e); } finally { setBusy(false); } }
  return <div className="space-y-4">
    <ol className="space-y-2 text-sm">{list.map(([a, e], i) => <li key={i} className="flex gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs text-primary">{i + 1}</span>{t(a, e)}</li>)}</ol>
    <div><div className="mb-1 flex items-center justify-between"><label className="label m-0">{t("النص", "Text")}</label><button className="flex items-center gap-1 text-xs text-primary" onClick={() => { void navigator.clipboard.writeText(text); toast.success(t("تم النسخ", "Copied")); }}><Copy className="h-3 w-3" />{t("نسخ", "Copy")}</button></div><pre className="whitespace-pre-wrap rounded-xl bg-muted p-3 font-sans text-sm">{text || "—"}</pre></div>
    <div><label className="label">{t("الملفات", "Files")}</label><div className="flex flex-wrap gap-2">{media.map((m: any) => <a key={m.asset.id} href={fileUrl(m.asset.id) + "?download=1"} className="btn-outline text-xs"><Download className="h-3.5 w-3.5" />{m.asset.name}</a>)}{media.length === 0 && <span className="text-xs text-subtle">—</span>}</div></div>
    <div className="flex gap-2 border-t border-border pt-4"><input className="input" dir="ltr" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} /><Button onClick={confirm} loading={busy}><CheckCircle2 className="h-4 w-4" />{t("تم النشر", "Mark published")}</Button></div>
  </div>;
}
