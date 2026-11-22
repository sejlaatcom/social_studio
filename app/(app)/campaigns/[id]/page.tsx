"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, Sparkles, Pencil, Trash2, ListChecks, Eye, Heart, MessageCircle, Share2, Plus, Lightbulb } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, SkeletonList, ErrorBox, Button, Modal, Confirm, StatCard, Badge, EmptyState, useToast } from "@/components/ui";
import { CampaignForm } from "@/components/campaign-form";
import { PlatformIcon } from "@/components/platform-icon";
import { StatusBadge } from "@/components/status";
import { usePerms } from "@/components/shell";
import { api } from "@/lib/client";

export default function Campaign({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT(); const locale = useLocale(); const toast = useToast(); const router = useRouter(); const can = usePerms();
  const { data: c, loading, error, reload } = useApi<any>(`/api/campaigns/${id}`);
  const [edit, setEdit] = useState(false); const [del, setDel] = useState(false); const [busy, setBusy] = useState("");
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !c) return <SkeletonList />;
  const n = (v: number) => Intl.NumberFormat("en", { notation: "compact" }).format(v);
  async function save(b: any) { setBusy("save"); try { await api(`/api/campaigns/${id}`, { method: "PATCH", body: b }); setEdit(false); reload(true); toast.success(t("تم الحفظ", "Saved")); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function plan() { setBusy("plan"); try { await api(`/api/campaigns/${id}/plan`, { method: "POST" }); reload(true); toast.success(t("تم إنشاء خطة الحملة", "Campaign plan generated")); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function apply() { setBusy("apply"); try { const r = await api(`/api/campaigns/${id}/apply`, { method: "POST" }); toast.success(t(`تم إنشاء ${r.created} مسودة على التقويم`, `Created ${r.created} drafts on the calendar`)); reload(true); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function setStatus(status: string) { await save({ status }); }
  const done = (c.byStatus.published ?? 0) + (c.byStatus.partially_published ?? 0);

  return <div>
    <PageHeader icon={<Megaphone />} title={c.name} subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={c.status} />{c.platforms.map((p: string) => <PlatformIcon key={p} platform={p} size={18} />)}<span>{c.startDate ? new Date(c.startDate).toLocaleDateString(locale) : ""} — {c.endDate ? new Date(c.endDate).toLocaleDateString(locale) : ""}</span></span>}
      actions={can("campaigns.manage") && <>
        <select className="input w-auto" value={c.status} onChange={(e) => setStatus(e.target.value)}>{[["planning", "تخطيط", "Planning"], ["active", "نشطة", "Active"], ["paused", "متوقفة", "Paused"], ["completed", "مكتملة", "Completed"], ["cancelled", "ملغاة", "Cancelled"]].map(([v, a, e]) => <option key={v} value={v}>{t(a, e)}</option>)}</select>
        <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />{t("تعديل", "Edit")}</Button>
        <Button variant="ghost" className="text-danger" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" /></Button></>} />

    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <StatCard label={t("الإنجاز", "Progress")} value={`${done}/${c.posts.length}`} icon={<ListChecks className="h-4 w-4" />} hint={c.targetPostCount ? t(`المستهدف ${c.targetPostCount}`, `Target ${c.targetPostCount}`) : undefined} />
      <StatCard label={t("مشاهدات/ظهور", "Views")} value={c.measured ? n(c.metrics.views) : "—"} icon={<Eye className="h-4 w-4" />} />
      <StatCard label={t("إعجابات", "Likes")} value={c.measured ? n(c.metrics.likes) : "—"} icon={<Heart className="h-4 w-4" />} tone="danger" />
      <StatCard label={t("تعليقات", "Comments")} value={c.measured ? n(c.metrics.comments) : "—"} icon={<MessageCircle className="h-4 w-4" />} tone="success" />
      <StatCard label={t("مشاركات", "Shares")} value={c.measured ? n(c.metrics.shares) : "—"} icon={<Share2 className="h-4 w-4" />} tone="warning" />
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" />{t("خطة الحملة بالذكاء الاصطناعي", "AI campaign plan")}</h3>
          {can("campaigns.manage") && <div className="flex gap-2"><Button variant="outline" onClick={plan} loading={busy === "plan"}><Sparkles className="h-4 w-4" />{c.plan ? t("إعادة التوليد", "Regenerate") : t("توليد الخطة", "Generate plan")}</Button>
            {c.plan && <Button onClick={apply} loading={busy === "apply"}><Plus className="h-4 w-4" />{t("تحويل الخطة إلى مسودات", "Create drafts from plan")}</Button>}</div>}
        </div>
        {busy === "plan" && <div className="space-y-2 py-4"><p className="text-sm text-subtle">{t("يعمل الذكاء الاصطناعي على بناء الخطة... قد يستغرق ذلك دقيقة.", "AI is building the plan… this can take a minute.")}</p><div className="skeleton h-24" /><div className="skeleton h-24" /></div>}
        {!c.plan ? <EmptyState icon={<Lightbulb />} title={t("لا توجد خطة بعد", "No plan yet")} body={t("سيُنشئ الذكاء الاصطناعي خطة أسبوعية بالمنشورات والنصوص والأوقات والتوزيع على المنصات بناءً على بيانات الحملة وهويتك.", "AI will create a weekly plan with posts, copy, timing and platform distribution based on the campaign and your brand.")} /> :
          <div className="space-y-4"><p className="text-sm leading-7">{c.plan.summary}</p><p className="rounded-xl bg-muted/60 p-3 text-sm leading-7 text-subtle">{c.plan.strategy}</p>
            {c.plan.weeks.map((w: any) => <div key={w.week}><h4 className="mb-2 text-sm font-semibold">{t("الأسبوع", "Week")} {w.week}: <span className="text-primary">{w.theme}</span></h4>
              <div className="space-y-2">{w.posts.map((p: any, i: number) => <details key={i} className="rounded-xl border border-border p-3"><summary className="flex cursor-pointer items-center gap-2 text-sm"><PlatformIcon platform={p.platform} size={18} /><b className="flex-1 truncate">{p.title}</b><Badge>{p.format}</Badge><span className="text-xs text-subtle">{t("يوم", "Day")} {p.dayOffset + 1} · {p.time}</span></summary>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{p.text}</p><div className="mt-1 text-xs text-primary">{p.hashtags.join(" ")}</div><p className="mt-2 text-xs text-subtle">🎨 {p.visualIdea}</p></details>)}</div></div>)}
          </div>}
      </Card>
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{t("منشورات الحملة", "Campaign posts")}</h3>{can("content.create") && <Link href={`/posts/new?campaignId=${id}`} className="text-xs text-primary">+ {t("منشور", "Post")}</Link>}</div>
        {c.posts.length === 0 ? <p className="text-sm text-subtle">{t("لا توجد منشورات بعد.", "No posts yet.")}</p> :
          <div className="space-y-1">{c.posts.map((p: any) => <Link key={p.id} href={`/posts/${p.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
            <div className="flex">{p.variants.map((v: any) => <PlatformIcon key={v.id} platform={v.platform} size={16} />)}</div><span className="flex-1 truncate text-sm">{p.title}</span>
            <span className="text-[11px] text-subtle">{p.scheduledAt ? new Date(p.scheduledAt).toLocaleDateString(locale, { day: "numeric", month: "short" }) : ""}</span><StatusBadge status={p.status} /></Link>)}</div>}
      </Card>
    </div>
    <Modal open={edit} onClose={() => setEdit(false)} size="lg" title={t("تعديل الحملة", "Edit campaign")}><CampaignForm initial={{ ...c, budget: c.budget ? Number(c.budget) : "" }} onSubmit={save} busy={busy === "save"} /></Modal>
    <Confirm open={del} onClose={() => setDel(false)} danger title={t("حذف الحملة؟", "Delete campaign?")} body={t("لن تُحذف المنشورات المرتبطة.", "Linked posts are kept.")} onConfirm={async () => { try { await api(`/api/campaigns/${id}`, { method: "DELETE" }); router.push("/campaigns"); } catch (e) { toast.error(e); } }} />
  </div>;
}
