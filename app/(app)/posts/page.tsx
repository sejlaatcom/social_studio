"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Plus, Search, Copy, Trash2 } from "lucide-react";
import { useApi, useDebounced } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, Tabs, SkeletonList, ErrorBox, EmptyState, Confirm, useToast } from "@/components/ui";
import { PlatformIcon } from "@/components/platform-icon";
import { StatusBadge } from "@/components/status";
import { AssetThumb } from "@/components/media";
import { usePerms } from "@/components/shell";
import { api } from "@/lib/client";

export default function Page() { return <Suspense><Posts /></Suspense>; }

function Posts() {
  const t = useT(); const locale = useLocale(); const toast = useToast(); const can = usePerms(); const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get("status") ?? ""); const [q, setQ] = useState(""); const [platform, setPlatform] = useState("");
  const dq = useDebounced(q);
  const { data, loading, error, reload } = useApi<any[]>(`/api/posts?status=${status}&q=${encodeURIComponent(dq)}&platform=${platform}`);
  const [del, setDel] = useState<string | null>(null);
  return <div>
    <PageHeader icon={<Send />} title={t("مركز النشر", "Publishing center")} subtitle={t("كل منشوراتك من الفكرة حتى النشر", "All your posts, from idea to published")}
      actions={can("content.create") && <Link href="/posts/new" className="btn-primary"><Plus className="h-4 w-4" />{t("منشور جديد", "New post")}</Link>} />
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Tabs value={status} onChange={setStatus} items={[{ value: "", label: t("الكل", "All") }, { value: "idea,draft,designing", label: t("مسودات", "Drafts") }, { value: "in_review", label: t("قيد المراجعة", "In review") }, { value: "approved", label: t("جاهزة", "Ready") }, { value: "scheduled", label: t("مجدولة", "Scheduled") }, { value: "published,partially_published", label: t("منشورة", "Published") }, { value: "failed", label: t("فشلت", "Failed") }]} />
      <div className="relative min-w-[200px] flex-1"><Search className="absolute start-3 top-2.5 h-4 w-4 text-subtle" /><input className="input ps-9" placeholder={t("بحث...", "Search...")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <select className="input w-auto" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">{t("كل المنصات", "All platforms")}</option>{["instagram", "x", "tiktok", "youtube", "snapchat", "gmail"].map((p) => <option key={p}>{p}</option>)}</select>
    </div>
    {error ? <ErrorBox error={error} onRetry={reload} /> : loading || !data ? <SkeletonList rows={6} /> : data.length === 0 ?
      <EmptyState icon={<Send />} title={t("لا توجد منشورات", "No posts")} body={t("ابدأ من استوديو المحتوى لتوليد منشورات لكل المنصات من فكرة واحدة.", "Start in the content studio to generate posts for every platform from one idea.")} action={<Link href="/studio" className="btn-primary">{t("افتح استوديو المحتوى", "Open content studio")}</Link>} /> :
      <Card className="divide-y divide-border">
        {data.map((p) => <div key={p.id} className="flex items-center gap-3 p-3 transition hover:bg-muted/50">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">{p.media[0] && <AssetThumb a={p.media[0].asset} />}</div>
          <Link href={`/posts/${p.id}`} className="min-w-0 flex-1"><div className="truncate font-medium">{p.title}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-subtle"><span>{p.author?.name}</span>·<span>{p.scheduledAt ? t("مجدول: ", "Scheduled: ") + new Date(p.scheduledAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : new Date(p.updatedAt).toLocaleDateString(locale)}</span>{p.campaignPosts[0] && <>·<span className="text-primary">{p.campaignPosts[0].campaign.name}</span></>}</div></Link>
          <div className="hidden gap-1 sm:flex">{p.variants.map((v: any) => <span key={v.id} title={v.status} className={`rounded-md p-0.5 ring-2 ${v.status === "published" ? "ring-success" : v.status === "failed" ? "ring-danger" : v.status === "manual_required" ? "ring-warning" : "ring-transparent"}`}><PlatformIcon platform={v.platform} size={20} /></span>)}</div>
          <StatusBadge status={p.status} />
          {can("content.create") && <button className="btn-ghost h-8 w-8 p-0" title={t("نسخ", "Duplicate")} onClick={async () => { try { await api(`/api/posts/${p.id}/duplicate`, { method: "POST" }); toast.success(t("تم النسخ", "Duplicated")); reload(true); } catch (e) { toast.error(e); } }}><Copy className="h-4 w-4" /></button>}
          {can("content.delete") && <button className="btn-ghost h-8 w-8 p-0 text-danger" onClick={() => setDel(p.id)}><Trash2 className="h-4 w-4" /></button>}
        </div>)}
      </Card>}
    <Confirm open={!!del} onClose={() => setDel(null)} danger title={t("حذف المنشور؟", "Delete post?")} body={t("سيُحذف من المنصة الداخلية فقط وليس من المنصات الاجتماعية.", "Deleted here only — not from the social platforms.")} onConfirm={async () => { try { await api(`/api/posts/${del}`, { method: "DELETE" }); setDel(null); reload(true); toast.success(t("تم الحذف", "Deleted")); } catch (e) { toast.error(e); } }} />
  </div>;
}
