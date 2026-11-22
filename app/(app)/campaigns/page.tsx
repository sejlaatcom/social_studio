"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Mail } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, SkeletonList, ErrorBox, EmptyState, Modal, useToast } from "@/components/ui";
import { CampaignForm } from "@/components/campaign-form";
import { PlatformIcon } from "@/components/platform-icon";
import { StatusBadge } from "@/components/status";
import { usePerms } from "@/components/shell";
import { api } from "@/lib/client";

export default function Campaigns() {
  const t = useT(); const locale = useLocale(); const toast = useToast(); const router = useRouter(); const can = usePerms();
  const { data, loading, error, reload } = useApi<any[]>("/api/campaigns");
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  async function create(b: any) { setBusy(true); try { const c = await api("/api/campaigns", { body: b }); router.push(`/campaigns/${c.id}`); } catch (e) { toast.error(e); } finally { setBusy(false); } }
  return <div>
    <PageHeader icon={<Megaphone />} title={t("إدارة الحملات", "Campaigns")} subtitle={t("خطط حملاتك ودع الذكاء الاصطناعي يبني خطة المحتوى", "Plan campaigns and let AI build the content plan")}
      actions={<><Link href="/email" className="btn-outline"><Mail className="h-4 w-4" />{t("الحملات البريدية", "Email campaigns")}</Link>{can("campaigns.manage") && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t("حملة جديدة", "New campaign")}</button>}</>} />
    {error ? <ErrorBox error={error} onRetry={reload} /> : loading || !data ? <SkeletonList /> : data.length === 0 ?
      <EmptyState icon={<Megaphone />} title={t("لا توجد حملات", "No campaigns")} body={t("مثال: حملة إطلاق منتج جديد خلال أسبوعين على إنستغرام وتيك توك.", "e.g. a two-week product launch on Instagram and TikTok.")} action={can("campaigns.manage") && <button className="btn-primary" onClick={() => setOpen(true)}>{t("أنشئ حملتك الأولى", "Create your first campaign")}</button>} /> :
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((c) => {
        const pct = c.postCount ? Math.round((c.published / c.postCount) * 100) : 0;
        return <Link key={c.id} href={`/campaigns/${c.id}`} className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
          <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{c.name}</h3><StatusBadge status={c.status} /></div>
          <p className="mt-1 line-clamp-2 min-h-[40px] text-sm text-subtle">{c.goal ?? "—"}</p>
          <div className="mt-3 flex gap-1">{c.platforms.map((p: string) => <PlatformIcon key={p} platform={p} size={20} />)}</div>
          <div className="mt-4 text-xs text-subtle">{c.startDate ? new Date(c.startDate).toLocaleDateString(locale) : "—"} → {c.endDate ? new Date(c.endDate).toLocaleDateString(locale) : "—"}</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
          <div className="mt-1 flex justify-between text-xs text-subtle"><span>{c.published}/{c.postCount} {t("منشور", "published")}</span><span>{pct}%</span></div>
        </Link>;
      })}</div>}
    <Modal open={open} onClose={() => setOpen(false)} size="lg" title={t("حملة جديدة", "New campaign")}><CampaignForm onSubmit={create} busy={busy} /></Modal>
  </div>;
}
