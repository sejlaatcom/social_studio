"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Send, Plus, Trash2, Image as ImageIcon, Wand2, Sparkles, ShieldCheck, CalendarDays, ArrowUp, ArrowDown, Eye } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/client";
import { xWeightedLength } from "@/lib/platforms";
import { useApi } from "./hooks";
import { useT } from "./i18n";
import { Card, Button, Field, TagInput, Modal, Badge, Tabs, Toggle, useToast, Spinner } from "./ui";
import { MediaPicker, AssetThumb, type Asset } from "./media";
import { PlatformIcon, PLATFORM_LABEL } from "./platform-icon";
import { usePerms } from "./shell";
import { PostPreview } from "./post-preview";

export type Variant = { id?: string; platform: string; socialAccountId: string | null; format: string; text: string; title: string | null; hashtags: string[]; threadParts: string[]; pollOptions: string[]; options: Record<string, any>; media?: { asset: Asset; altText?: string | null }[]; status?: string };
export type Draft = { id?: string; title: string; body: string; status: string; contentType: string | null; campaignId: string | null; ideaId?: string | null; plannedAt?: string | null; media: { asset: Asset; altText?: string | null }[]; variants: Variant[] };

const FORMATS: Record<string, string[]> = { instagram: ["post", "carousel", "reel", "story"], x: ["post", "thread", "poll"], tiktok: ["video"], youtube: ["video", "short"], snapchat: ["story"], gmail: ["email"] };
const LIMITS: Record<string, number> = { instagram: 2200, x: 280, tiktok: 2200, youtube: 5000, snapchat: 250, gmail: 100000 };
const FORMAT_LABEL: Record<string, [string, string]> = { post: ["منشور", "Post"], carousel: ["Carousel", "Carousel"], reel: ["Reel", "Reel"], story: ["Story", "Story"], thread: ["سلسلة", "Thread"], poll: ["استطلاع", "Poll"], video: ["فيديو", "Video"], short: ["Shorts", "Shorts"], email: ["بريد", "Email"] };
const CONTENT_TYPES: [string, string, string][] = [["educational", "تعليمي", "Educational"], ["promotional", "ترويجي", "Promotional"], ["engagement", "تفاعلي", "Engagement"], ["announcement", "إعلان", "Announcement"], ["behind_the_scenes", "خلف الكواليس", "Behind the scenes"], ["testimonial", "آراء العملاء", "Testimonial"], ["entertainment", "ترفيهي", "Entertainment"]];

export function newVariant(platform: string, accountId: string | null, base: string): Variant {
  return { platform, socialAccountId: accountId, format: FORMATS[platform][0], text: base, title: null, hashtags: [], threadParts: [], pollOptions: [], options: platform === "youtube" ? { privacyStatus: "public", madeForKids: false } : platform === "tiktok" ? { privacyLevel: "PUBLIC_TO_EVERYONE" } : {} };
}

export function textLen(platform: string, text: string) { return platform === "x" ? xWeightedLength(text) : [...text].length; }

export function Composer({ initial }: { initial: Draft }) {
  const t = useT(); const toast = useToast(); const router = useRouter(); const can = usePerms();
  const [d, setD] = useState<Draft>(initial);
  const [tab, setTab] = useState<string>(initial.variants[0]?.platform ? "0" : "base");
  const [pick, setPick] = useState<null | "base" | number>(null);
  const [busy, setBusy] = useState(""); const [dirty, setDirty] = useState(false);
  const [checks, setChecks] = useState<any[] | null>(null); const [schedOpen, setSchedOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState<null | number>(null);
  const { data: acc } = useApi<any>("/api/accounts");
  const { data: campaigns } = useApi<any[]>("/api/campaigns");
  const accounts: any[] = acc?.accounts ?? [];
  const locked = ["publishing"].includes(d.status);

  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, [dirty]);
  const upd = (patch: Partial<Draft>) => { setD((x) => ({ ...x, ...patch })); setDirty(true); };
  const updV = (i: number, patch: Partial<Variant>) => { setD((x) => ({ ...x, variants: x.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) })); setDirty(true); };

  function togglePlatform(p: string) {
    const exists = d.variants.findIndex((v) => v.platform === p);
    if (exists >= 0) { const vs = d.variants.filter((_, j) => j !== exists); upd({ variants: vs }); setTab(vs.length ? "0" : "base"); return; }
    const a = accounts.find((x) => x.platform === p && x.status === "connected");
    const vs = [...d.variants, newVariant(p, a?.id ?? null, d.body)]; upd({ variants: vs }); setTab(String(vs.length - 1));
  }

  function payload(status?: string) {
    return {
      title: d.title || t("منشور بدون عنوان", "Untitled post"), body: d.body, status: status ?? (["idea", "draft", "designing", "in_review", "approved", "postponed", "cancelled"].includes(d.status) ? d.status : undefined),
      contentType: d.contentType, campaignId: d.campaignId, ideaId: d.ideaId ?? null, scheduledAt: d.id ? undefined : d.plannedAt ?? undefined,
      media: d.media.map((m) => ({ assetId: m.asset.id, altText: m.altText ?? null })),
      variants: d.variants.map((v) => ({ id: v.id, platform: v.platform, socialAccountId: v.socialAccountId, format: v.format, text: v.text, title: v.title, hashtags: v.hashtags, threadParts: v.threadParts, pollOptions: v.pollOptions, options: v.options, media: v.media?.map((m) => ({ assetId: m.asset.id, altText: m.altText ?? null })) })),
    };
  }
  async function save(status?: string): Promise<string | null> {
    setBusy("save");
    try {
      const r = d.id ? await api(`/api/posts/${d.id}`, { method: "PUT", body: payload(status) }) : await api("/api/posts", { body: payload(status) });
      setDirty(false); if (status) setD((x) => ({ ...x, status: r.status }));
      if (!d.id) { toast.success(t("تم حفظ المسودة", "Draft saved")); router.replace(`/posts/${r.id}`); return r.id; }
      toast.success(t("تم الحفظ", "Saved")); router.refresh(); return r.id;
    } catch (e) { toast.error(e); return null; } finally { setBusy(""); }
  }
  async function validate() {
    const id = dirty || !d.id ? await save() : d.id; if (!id) return;
    setBusy("validate");
    try { setChecks(await api(`/api/posts/${id}/validate`)); } catch (e) { toast.error(e); } finally { setBusy(""); }
  }
  async function submitReview() {
    const id = dirty || !d.id ? await save() : d.id; if (!id) return;
    try { await api(`/api/posts/${id}/approval`, { body: { action: "submit" } }); setD((x) => ({ ...x, status: "in_review" })); toast.success(t("أُرسل للمراجعة", "Submitted for review")); router.refresh(); } catch (e) { toast.error(e); }
  }
  async function publish(mode: "now" | "schedule", at?: string) {
    const id = dirty || !d.id ? await save() : d.id; if (!id) return;
    setBusy(mode);
    try {
      const r = await api(`/api/posts/${id}/schedule`, { body: { mode, at } });
      setChecks(r.checks);
      if (!r.ok) { toast.error(t("يوجد أخطاء يجب إصلاحها قبل النشر", "Fix the errors before publishing")); return; }
      toast.success(mode === "now" ? t("بدأ النشر — ستصلك النتيجة بعد تأكيد المنصة", "Publishing started — result arrives after platform confirmation") : t("تمت الجدولة", "Scheduled"));
      setSchedOpen(false); router.refresh(); window.location.reload();
    } catch (e) { toast.error(e); } finally { setBusy(""); }
  }

  const i = tab === "base" ? -1 : Number(tab); const v = i >= 0 ? d.variants[i] : null;
  const media = v?.media ?? d.media;
  const len = v ? textLen(v.platform, [v.text, v.hashtags.join(" ")].filter(Boolean).join("\n\n")) : 0;

  return <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_200px]">
          <Field label={t("عنوان داخلي للمنشور", "Internal title")}><input className="input" value={d.title} onChange={(e) => upd({ title: e.target.value })} disabled={locked} /></Field>
          <Field label={t("نوع المحتوى", "Content type")}><select className="input" value={d.contentType ?? ""} onChange={(e) => upd({ contentType: e.target.value || null })}><option value="">—</option>{CONTENT_TYPES.map(([k, a, e]) => <option key={k} value={k}>{t(a, e)}</option>)}</select></Field>
          <Field label={t("الحملة", "Campaign")}><select className="input" value={d.campaignId ?? ""} onChange={(e) => upd({ campaignId: e.target.value || null })}><option value="">—</option>{campaigns?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <div>
          <label className="label">{t("المنصات", "Platforms")}</label>
          <div className="flex flex-wrap gap-2">{Object.keys(FORMATS).map((p) => { const on = d.variants.some((v) => v.platform === p); const has = accounts.some((a) => a.platform === p);
            return <button key={p} disabled={locked} onClick={() => togglePlatform(p)} className={clsx("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition", on ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted")}>
              <PlatformIcon platform={p} size={20} />{t(PLATFORM_LABEL[p][0], PLATFORM_LABEL[p][1])}{!has && <span className="text-[10px] text-subtle">({t("غير مرتبط", "not linked")})</span>}</button>; })}</div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-border pb-3">
          <button onClick={() => setTab("base")} className={clsx("rounded-lg px-3 py-1.5 text-sm", tab === "base" ? "bg-muted font-medium" : "text-subtle")}>{t("المحتوى الأساسي", "Base content")}</button>
          {d.variants.map((vv, j) => <button key={j} onClick={() => setTab(String(j))} className={clsx("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm", tab === String(j) ? "bg-muted font-medium" : "text-subtle")}><PlatformIcon platform={vv.platform} size={16} />{t(PLATFORM_LABEL[vv.platform][0], PLATFORM_LABEL[vv.platform][1])}{vv.status && vv.status !== "pending" && <span className={clsx("h-1.5 w-1.5 rounded-full", vv.status === "published" ? "bg-success" : vv.status === "failed" ? "bg-danger" : "bg-warning")} />}</button>)}
        </div>

        {!v ? <div className="space-y-3">
          <Field label={t("النص الأساسي (يُنسخ للمنصات الجديدة ويمكن تخصيصه لكل منصة)", "Base text (copied to new platforms, customizable per platform)")}><textarea className="input min-h-[180px] leading-7" value={d.body} onChange={(e) => upd({ body: e.target.value })} disabled={locked} /></Field>
          <MediaStrip items={d.media} onChange={(m) => upd({ media: m })} onAdd={() => setPick("base")} disabled={locked} />
          {d.variants.length > 0 && <Button variant="outline" onClick={() => upd({ variants: d.variants.map((x) => (x.status === "published" ? x : { ...x, text: d.body })) })}>{t("تطبيق النص الأساسي على كل المنصات", "Apply base text to all platforms")}</Button>}
        </div> : <div className="space-y-4">
          {v.status === "published" && <div className="rounded-xl bg-success/10 p-3 text-sm text-success">{t("تم نشر هذا الإصدار ولا يمكن تعديله.", "This variant is published and locked.")}</div>}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("الحساب", "Account")}><select className="input" value={v.socialAccountId ?? ""} onChange={(e) => updV(i, { socialAccountId: e.target.value || null })}>
              <option value="">{t("— بدون حساب (نشر يدوي/مسودة) —", "— no account (manual/draft) —")}</option>
              {accounts.filter((a) => a.platform === v.platform).map((a) => <option key={a.id} value={a.id}>{a.displayName}{a.status !== "connected" ? ` (${a.status})` : ""}</option>)}</select></Field>
            <Field label={t("الصيغة", "Format")}><Tabs value={v.format} onChange={(f) => updV(i, { format: f })} items={FORMATS[v.platform].map((f) => ({ value: f, label: t(FORMAT_LABEL[f][0], FORMAT_LABEL[f][1]) }))} /></Field>
          </div>
          {(v.platform === "youtube" || v.platform === "gmail") && <Field label={v.platform === "gmail" ? t("عنوان الرسالة (Subject)", "Subject") : t("عنوان الفيديو", "Video title")} hint={v.platform === "youtube" ? `${(v.title ?? "").length}/100` : undefined}><input className="input" value={v.title ?? ""} onChange={(e) => updV(i, { title: e.target.value })} /></Field>}
          {v.format === "thread" ? <ThreadEditor parts={v.threadParts.length ? v.threadParts : [v.text]} onChange={(p) => updV(i, { threadParts: p })} /> :
            <Field label={v.platform === "youtube" ? t("الوصف", "Description") : v.platform === "gmail" ? t("نص الرسالة", "Message body") : t("النص", "Text")}>
              <textarea className="input min-h-[170px] leading-7" value={v.text} onChange={(e) => updV(i, { text: e.target.value })} />
              <div className="mt-1 flex items-center justify-between text-xs"><button className="flex items-center gap-1 text-primary" onClick={() => setAiOpen(i)}><Wand2 className="h-3.5 w-3.5" />{t("تحسين بالذكاء الاصطناعي", "Improve with AI")}</button><span className={clsx("tabular-nums", len > LIMITS[v.platform] ? "font-semibold text-danger" : "text-subtle")}>{len}/{LIMITS[v.platform]}</span></div>
            </Field>}
          {v.format === "poll" && <Field label={t("خيارات الاستطلاع (2-4)", "Poll options (2-4)")}><TagInput value={v.pollOptions} onChange={(p) => updV(i, { pollOptions: p.slice(0, 4) })} /></Field>}
          {v.platform !== "gmail" && <Field label={v.platform === "youtube" ? t("الوسوم Tags/الهاشتاقات", "Tags / hashtags") : t("الهاشتاقات", "Hashtags")}><TagInput value={v.hashtags} onChange={(h) => updV(i, { hashtags: h })} prefix="#" placeholder="#..." /></Field>}
          <PlatformOptions v={v} onChange={(o) => updV(i, { options: { ...v.options, ...o } })} />
          <div>
            <div className="mb-2 flex items-center gap-2"><Toggle checked={!!v.media} onChange={(on) => updV(i, { media: on ? [...d.media] : undefined })} label={t("وسائط مخصصة لهذه المنصة", "Custom media for this platform")} /></div>
            <MediaStrip items={media} onChange={(m) => updV(i, v.media ? { media: m } : {})} onAdd={() => setPick(v.media ? i : "base")} disabled={!v.media && false} showAlt={v.platform === "instagram"} />
          </div>
        </div>}
      </Card>
    </div>

    <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4" />{t("معاينة", "Preview")}</h3>{v && <PlatformIcon platform={v.platform} size={18} />}</div>
        {v ? <PostPreview v={v} media={media.map((m) => m.asset)} account={accounts.find((a) => a.id === v.socialAccountId)} /> : <p className="text-sm text-subtle">{t("اختر منصة لعرض المعاينة", "Pick a platform tab to preview")}</p>}
      </Card>
      <Card className="space-y-2 p-4">
        {can("content.edit") && <Button variant="outline" className="w-full" loading={busy === "save"} onClick={() => save()} disabled={locked}><Save className="h-4 w-4" />{t("حفظ كمسودة", "Save draft")}</Button>}
        <Button variant="outline" className="w-full" loading={busy === "validate"} onClick={validate}><ShieldCheck className="h-4 w-4" />{t("فحص ما قبل النشر", "Pre-publish check")}</Button>
        {can("content.edit") && !["in_review", "approved", "scheduled", "published"].includes(d.status) && <Button variant="outline" className="w-full" onClick={submitReview}><Send className="h-4 w-4" />{t("إرسال للمراجعة", "Submit for review")}</Button>}
        {can("content.publish") && <>
          <Button className="w-full" onClick={() => setSchedOpen(true)} disabled={!d.variants.length || locked}><CalendarDays className="h-4 w-4" />{d.status === "scheduled" ? t("تعديل الجدولة", "Reschedule") : t("جدولة", "Schedule")}</Button>
          <Button className="w-full" variant="outline" loading={busy === "now"} onClick={() => publish("now")} disabled={!d.variants.length || locked}><Send className="h-4 w-4" />{t("انشر الآن", "Publish now")}</Button>
        </>}
        {checks && <div className="space-y-1.5 border-t border-border pt-3">{checks.map((c, k) => <div key={k} className={clsx("flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs", c.level === "error" ? "bg-danger/10 text-danger" : c.level === "warning" ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>
          {c.platform !== "-" && <PlatformIcon platform={c.platform} size={14} />}<span className="leading-5">{c.message}</span></div>)}</div>}
      </Card>
    </div>

    <MediaPicker open={pick !== null} multiple onClose={() => setPick(null)} onPick={(as) => {
      const add = as.map((a) => ({ asset: a, altText: null }));
      if (pick === "base") upd({ media: [...d.media, ...add] }); else if (typeof pick === "number") updV(pick, { media: [...(d.variants[pick].media ?? []), ...add] });
    }} />
    <ScheduleModal open={schedOpen} onClose={() => setSchedOpen(false)} onConfirm={(at) => publish("schedule", at)} loading={busy === "schedule"} platforms={d.variants.map((x) => x.platform)} />
    {aiOpen !== null && <AIRewrite text={d.variants[aiOpen].text} platform={d.variants[aiOpen].platform} onClose={() => setAiOpen(null)} onPick={(txt) => { updV(aiOpen, { text: txt }); setAiOpen(null); }} />}
  </div>;
}

function MediaStrip({ items, onChange, onAdd, disabled, showAlt }: { items: { asset: Asset; altText?: string | null }[]; onChange: (m: { asset: Asset; altText?: string | null }[]) => void; onAdd: () => void; disabled?: boolean; showAlt?: boolean }) {
  const t = useT();
  const move = (i: number, d: number) => { const a = [...items]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); onChange(a); };
  return <div>
    <label className="label">{t("الوسائط", "Media")} ({items.length})</label>
    <div className="flex flex-wrap gap-3">
      {items.map((m, i) => <div key={m.asset.id + i} className="group w-28">
        <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-border"><AssetThumb a={m.asset} />
          {!disabled && <div className="absolute inset-0 flex items-end justify-center gap-1 bg-black/40 p-1 opacity-0 transition group-hover:opacity-100">
            {i > 0 && <button className="rounded bg-white/90 p-1 text-black" onClick={() => move(i, -1)}><ArrowUp className="h-3 w-3 rotate-[-90deg] rtl:rotate-90" /></button>}
            {i < items.length - 1 && <button className="rounded bg-white/90 p-1 text-black" onClick={() => move(i, 1)}><ArrowDown className="h-3 w-3 rotate-[-90deg] rtl:rotate-90" /></button>}
            <button className="rounded bg-white/90 p-1 text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></button></div>}
          <span className="absolute start-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white" dir="ltr">{m.asset.width ? `${m.asset.width}×${m.asset.height}` : ""}</span>
        </div>
        {showAlt && m.asset.mimeType.startsWith("image/") && <input className="mt-1 w-full rounded-md border border-border bg-surface px-1.5 py-1 text-[11px]" placeholder={t("نص بديل", "Alt text")} value={m.altText ?? ""} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, altText: e.target.value } : x)))} />}
      </div>)}
      {!disabled && <button onClick={onAdd} className="grid h-28 w-28 place-items-center rounded-xl border-2 border-dashed border-border text-subtle transition hover:border-primary hover:text-primary"><div className="text-center text-xs"><ImageIcon className="mx-auto mb-1 h-5 w-5" />{t("إضافة", "Add")}</div></button>}
    </div>
  </div>;
}

function ThreadEditor({ parts, onChange }: { parts: string[]; onChange: (p: string[]) => void }) {
  const t = useT();
  return <div className="space-y-2"><label className="label">{t("سلسلة التغريدات", "Thread")}</label>
    {parts.map((p, i) => { const l = xWeightedLength(p); return <div key={i} className="relative">
      <span className="absolute -start-1 top-3 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-primary text-[10px] text-white rtl:translate-x-1/2">{i + 1}</span>
      <textarea className="input min-h-[80px] ps-6" value={p} onChange={(e) => onChange(parts.map((x, j) => (j === i ? e.target.value : x)))} />
      <div className="flex justify-between text-xs"><button className="text-danger" onClick={() => onChange(parts.filter((_, j) => j !== i))} disabled={parts.length === 1}>{t("حذف", "Remove")}</button><span className={l > 280 ? "text-danger" : "text-subtle"}>{l}/280</span></div>
    </div>; })}
    <Button variant="outline" onClick={() => onChange([...parts, ""])}><Plus className="h-4 w-4" />{t("تغريدة", "Tweet")}</Button>
  </div>;
}

function PlatformOptions({ v, onChange }: { v: Variant; onChange: (o: Record<string, any>) => void }) {
  const t = useT(); const o = v.options ?? {};
  if (v.platform === "youtube") return <div className="grid gap-3 rounded-xl bg-muted/50 p-3 md:grid-cols-2">
    <Field label={t("الخصوصية", "Privacy")}><select className="input" value={o.privacyStatus ?? "public"} onChange={(e) => onChange({ privacyStatus: e.target.value })}><option value="public">{t("عام", "Public")}</option><option value="unlisted">{t("غير مدرج", "Unlisted")}</option><option value="private">{t("خاص", "Private")}</option></select></Field>
    <Field label={t("معرف قائمة التشغيل (اختياري)", "Playlist ID (optional)")}><input className="input" dir="ltr" value={o.playlistId ?? ""} onChange={(e) => onChange({ playlistId: e.target.value || undefined })} /></Field>
    <Field label={t("الفئة", "Category ID")}><input className="input" dir="ltr" value={o.categoryId ?? "22"} onChange={(e) => onChange({ categoryId: e.target.value })} /></Field>
    <div className="space-y-2 pt-5"><Toggle checked={!!o.madeForKids} onChange={(x) => onChange({ madeForKids: x })} label={t("مخصص للأطفال (الجمهور)", "Made for kids (audience)")} /><Toggle checked={!!o.useNativeSchedule} onChange={(x) => onChange({ useNativeSchedule: x })} label={t("رفع مبكر وجدولة YouTube الأصلية", "Upload early, YouTube native schedule")} /></div>
    <p className="text-xs text-subtle md:col-span-2">{t("الصورة الأولى المرفقة تُستخدم كـ Thumbnail (يتطلب حسابًا موثقًا).", "The first attached image is used as the thumbnail (requires verified channel).")}</p>
  </div>;
  if (v.platform === "tiktok") return <div className="grid gap-3 rounded-xl bg-muted/50 p-3 md:grid-cols-2">
    <Field label={t("الخصوصية", "Privacy")} hint={t("تحدد المنصة الخيارات المتاحة لحسابك؛ التطبيقات غير المدققة تنشر خاصًا فقط", "TikTok decides allowed options; unaudited apps post private only")}><select className="input" value={o.privacyLevel ?? "PUBLIC_TO_EVERYONE"} onChange={(e) => onChange({ privacyLevel: e.target.value })}><option value="PUBLIC_TO_EVERYONE">{t("عام", "Public")}</option><option value="MUTUAL_FOLLOW_FRIENDS">{t("الأصدقاء", "Friends")}</option><option value="FOLLOWER_OF_CREATOR">{t("المتابعون", "Followers")}</option><option value="SELF_ONLY">{t("أنا فقط", "Only me")}</option></select></Field>
    <div className="space-y-2 pt-5"><Toggle checked={!!o.disableComment} onChange={(x) => onChange({ disableComment: x })} label={t("تعطيل التعليقات", "Disable comments")} /><Toggle checked={!!o.disableDuet} onChange={(x) => onChange({ disableDuet: x })} label={t("تعطيل Duet", "Disable Duet")} /><Toggle checked={!!o.brandedContent} onChange={(x) => onChange({ brandedContent: x })} label={t("محتوى مدفوع لعلامة", "Branded content")} /></div>
  </div>;
  if (v.platform === "gmail") return <div className="rounded-xl bg-muted/50 p-3"><Field label={t("المستلم", "Recipient")} hint={t("للإرسال الجماعي استخدم الحملات البريدية", "For bulk sending use email campaigns")}><input className="input" dir="ltr" type="email" value={o.to ?? ""} onChange={(e) => onChange({ to: e.target.value })} /></Field></div>;
  if (v.platform === "x" && v.format === "poll") return <div className="rounded-xl bg-muted/50 p-3"><Field label={t("مدة الاستطلاع (دقائق)", "Poll duration (minutes)")}><input className="input" type="number" min={5} max={10080} value={o.pollDurationMinutes ?? 1440} onChange={(e) => onChange({ pollDurationMinutes: Number(e.target.value) })} /></Field></div>;
  if (v.platform === "snapchat") return <div className="rounded-xl bg-warning/10 p-3 text-xs text-warning">{t("Snapchat لا يوفر API للنشر العضوي — عند موعد النشر ستحصل على حزمة جاهزة (نص + ملفات) لنشرها يدويًا ثم تأكيد النشر.", "Snapchat has no organic publishing API — at publish time you'll get a ready kit (text + files) to post manually and confirm.")}</div>;
  return null;
}

function ScheduleModal({ open, onClose, onConfirm, loading, platforms }: { open: boolean; onClose: () => void; onConfirm: (iso: string) => void; loading: boolean; platforms: string[] }) {
  const t = useT();
  const def = useMemo(() => { const d = new Date(Date.now() + 3600000); d.setMinutes(0, 0, 0); const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16); }, []);
  const [val, setVal] = useState(def);
  const { data: best } = useApi<any>(open ? `/api/analytics/best-times${platforms.length === 1 ? `?platform=${platforms[0]}` : ""}` : null);
  return <Modal open={open} onClose={onClose} title={t("جدولة النشر", "Schedule")} size="sm" footer={<><Button variant="ghost" onClick={onClose}>{t("إلغاء", "Cancel")}</Button><Button loading={loading} onClick={() => onConfirm(new Date(val).toISOString())}>{t("تأكيد الجدولة", "Confirm")}</Button></>}>
    <Field label={t("التاريخ والوقت (بتوقيتك المحلي)", "Date & time (your local time)")}><input type="datetime-local" className="input" value={val} onChange={(e) => setVal(e.target.value)} /></Field>
    <div className="mt-4 rounded-xl bg-muted/50 p-3 text-xs">
      <div className="mb-1 flex items-center gap-1 font-medium"><Sparkles className="h-3.5 w-3.5 text-primary" />{t("أفضل أوقات النشر لحسابك", "Best times for your account")}</div>
      {!best ? <Spinner /> : best.sufficient ? <div className="flex flex-wrap gap-1.5">{best.ranked.slice(0, 5).map((r: any) => { const d = new Date(); d.setUTCHours(r.hourUtc, 0, 0, 0); return <button key={r.hourUtc} className="chip bg-primary/10 text-primary" onClick={() => { const x = new Date(val); x.setHours(d.getHours(), 0); const off = x.getTimezoneOffset(); setVal(new Date(x.getTime() - off * 60000).toISOString().slice(0, 16)); }}>{d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</button>; })}</div>
        : <p className="text-subtle">{t(`تتوفر التوصيات بعد قياس أداء 10 منشورات على الأقل (حاليًا ${best.sampleSize}).`, `Recommendations appear after at least 10 measured posts (currently ${best.sampleSize}).`)}</p>}
    </div>
  </Modal>;
}

function AIRewrite({ text, platform, onClose, onPick }: { text: string; platform: string; onClose: () => void; onPick: (t: string) => void }) {
  const t = useT(); const toast = useToast();
  const [instruction, setInstruction] = useState(t(`أعد صياغته ليناسب ${PLATFORM_LABEL[platform][0]} بأسلوب جذاب`, `Rewrite for ${PLATFORM_LABEL[platform][1]} in an engaging style`));
  const [res, setRes] = useState<{ label: string; text: string }[] | null>(null); const [busy, setBusy] = useState(false);
  const presets: [string, string][] = [["اجعله أكثر احترافية", "Make it more professional"], ["اختصره", "Shorten it"], ["حوّله إلى قصة", "Turn it into a story"], ["أضف دعوة واضحة لاتخاذ إجراء", "Add a clear CTA"], ["بأسلوب ودود", "Friendlier tone"], ["ترجمه للإنجليزية", "Translate to English"]];
  async function run() { setBusy(true); try { setRes((await api("/api/ai/rewrite", { body: { text, instruction, platform } })).variants); } catch (e) { toast.error(e); } finally { setBusy(false); } }
  return <Modal open onClose={onClose} title={t("إعادة الصياغة بالذكاء الاصطناعي", "AI rewrite")} size="lg">
    <div className="mb-2 flex flex-wrap gap-1.5">{presets.map(([a, e]) => <button key={a} className="chip bg-muted hover:bg-primary/10" onClick={() => setInstruction(t(a, e))}>{t(a, e)}</button>)}</div>
    <div className="flex gap-2"><input className="input" value={instruction} onChange={(e) => setInstruction(e.target.value)} /><Button onClick={run} loading={busy} disabled={!text.trim()}><Wand2 className="h-4 w-4" />{t("توليد", "Generate")}</Button></div>
    {!text.trim() && <p className="mt-2 text-xs text-warning">{t("اكتب نصًا أولًا", "Write some text first")}</p>}
    {res && <div className="mt-4 space-y-3">{res.map((r, i) => <Card key={i} className="p-3"><div className="mb-1 flex items-center justify-between"><Badge tone="primary">{r.label}</Badge><Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => onPick(r.text)}>{t("استخدام", "Use")}</Button></div><p className="whitespace-pre-wrap text-sm leading-7">{r.text}</p></Card>)}</div>}
  </Modal>;
}

