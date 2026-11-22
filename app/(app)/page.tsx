"use client";
import Link from "next/link";
import { useState } from "react";
import { Users2, Send, CalendarDays, Eye, FileText, Megaphone, Heart, AlertTriangle, Sparkles, Clock, Activity, TrendingUp, Plus, Plug } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, StatCard, Skeleton, EmptyState, ErrorBox, Button, PageHeader, useToast } from "@/components/ui";
import { RangePicker, rangeQuery, type RangeValue } from "@/components/range-picker";
import { TrendChart, BarsChart } from "@/components/charts";
import { PlatformIcon, PLATFORM_LABEL } from "@/components/platform-icon";
import { StatusBadge } from "@/components/status";
import { api } from "@/lib/client";

const n = (v: number | null | undefined) => (v == null ? "—" : Intl.NumberFormat("en", { notation: "compact" }).format(v));

export default function Dashboard() {
  const t = useT(); const locale = useLocale(); const toast = useToast();
  const [range, setRange] = useState<RangeValue>({ range: "month" });
  const { data, error, loading, reload } = useApi<any>(`/api/dashboard?${rangeQuery(range)}`);
  const [ai, setAi] = useState<{ summary: string; insights: string[]; recommendations: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const pl = (p: string) => t(PLATFORM_LABEL[p]?.[0] ?? p, PLATFORM_LABEL[p]?.[1] ?? p);

  async function aiSummary() {
    setAiLoading(true);
    try { setAi(await api(`/api/analytics/insights?${rangeQuery(range)}`, { method: "POST", body: {} })); } catch (e) { toast.error(e); } finally { setAiLoading(false); }
  }

  return <div>
    <PageHeader title={t("لوحة التحكم", "Dashboard")} subtitle={t("نظرة شاملة على حساباتك ومحتواك وأدائك الفعلي", "An overview of your accounts, content and real performance")}
      actions={<><RangePicker value={range} onChange={setRange} /><Link href="/studio" className="btn-primary"><Plus className="h-4 w-4" />{t("محتوى جديد", "New content")}</Link></>} />
    {error ? <ErrorBox error={error} onRetry={reload} /> : null}
    {loading || !data ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div> : <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t("الحسابات المرتبطة", "Connected accounts")} value={data.counts.accounts} icon={<Users2 className="h-4 w-4" />} />
        <StatCard label={t("منشورات منشورة", "Published")} value={data.counts.published} icon={<Send className="h-4 w-4" />} tone="success" hint={t("خلال الفترة", "In period")} />
        <StatCard label={t("مجدولة", "Scheduled")} value={data.counts.scheduled} icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label={t("قيد المراجعة", "In review")} value={data.counts.inReview} icon={<Clock className="h-4 w-4" />} tone="warning" />
        <StatCard label={t("المسودات", "Drafts")} value={data.counts.drafts} icon={<FileText className="h-4 w-4" />} />
        <StatCard label={t("الحملات", "Campaigns")} value={data.counts.campaigns} icon={<Megaphone className="h-4 w-4" />} />
      </div>

      {data.accounts.length === 0 && <Card className="mt-6 flex flex-col items-start gap-4 bg-gradient-to-br from-primary/10 to-transparent p-6 sm:flex-row sm:items-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white"><Plug /></div>
        <div className="flex-1"><h3 className="font-semibold">{t("ابدأ بربط حساباتك", "Start by connecting your accounts")}</h3><p className="text-sm text-subtle">{t("تظهر الإحصاءات هنا فقط بعد ربط الحسابات ومزامنة بياناتها الفعلية من المنصات.", "Statistics appear here only after you connect accounts and sync their real data.")}</p></div>
        <Link href="/accounts" className="btn-primary">{t("ربط حساب", "Connect account")}</Link>
      </Card>}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="font-semibold">{t("التفاعل خلال الفترة", "Engagement over time")}</h3><p className="text-xs text-subtle">{t("إعجابات + تعليقات + مشاركات + حفظ للمنشورات المنشورة من المنصة", "Likes + comments + shares + saves on posts published from the platform")}</p></div>
            <div className="flex gap-4 text-sm"><span className="flex items-center gap-1"><Heart className="h-4 w-4 text-subtle" />{n(data.summary.totals.engagement)}</span><span className="flex items-center gap-1"><Eye className="h-4 w-4 text-subtle" />{n(data.summary.totals.views + data.summary.totals.impressions)}</span><span className="flex items-center gap-1"><TrendingUp className="h-4 w-4 text-subtle" />{data.summary.totals.engagementRate == null ? "—" : (data.summary.totals.engagementRate * 100).toFixed(1) + "%"}</span></div>
          </div>
          {data.summary.daily.length ? <TrendChart data={data.summary.daily} x="date" y="engagement" label={t("التفاعل", "Engagement")} /> :
            <EmptyState icon={<Activity />} title={t("لا توجد بيانات أداء بعد", "No performance data yet")} body={t("تُجمع المقاييس تلقائيًا كل 6 ساعات من المنصات للمنشورات التي نُشرت عبر المنصة.", "Metrics are pulled every 6 hours from the platforms for posts published through the platform.")} />}
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{t("الملخص الذكي", "AI summary")}</h3><Sparkles className="h-4 w-4 text-primary" /></div>
          {ai ? <div className="space-y-3 text-sm leading-7"><p>{ai.summary}</p>{ai.recommendations.length > 0 && <ul className="list-disc space-y-1 ps-5 text-subtle">{ai.recommendations.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}</ul>}<Link href="/analytics" className="text-xs text-primary">{t("التحليل الكامل ←", "Full analysis →")}</Link></div> :
            <div className="text-sm text-subtle"><p className="mb-4">{data.summary.hasData ? t("احصل على تحليل لأدائك الفعلي مع توصيات عملية.", "Get an analysis of your actual performance with recommendations.") : t("سيتوفر الملخص بعد مزامنة بيانات أداء فعلية.", "Available once real performance data is synced.")}</p>
              <Button variant="outline" onClick={aiSummary} loading={aiLoading} disabled={!data.summary.hasData}><Sparkles className="h-4 w-4" />{t("توليد الملخص", "Generate summary")}</Button></div>}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">{t("أداء المنصات", "Platform performance")}</h3>
          {Object.keys(data.summary.byPlatform).length === 0 ? <p className="text-sm text-subtle">{t("لا توجد حسابات مرتبطة.", "No connected accounts.")}</p> :
            <div className="space-y-2">{Object.entries(data.summary.byPlatform).map(([p, v]: [string, any]) => (
              <div key={p} className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5"><PlatformIcon platform={p} size={26} /><span className="flex-1 text-sm font-medium">{pl(p)}</span><span className="text-xs text-subtle">{v.posts} {t("منشور", "posts")}</span><span className="w-16 text-end text-sm font-semibold tabular-nums">{n(v.engagement)}</span></div>))}
            </div>}
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{t("المنشورات القادمة", "Upcoming posts")}</h3><Link href="/calendar" className="text-xs text-primary">{t("التقويم", "Calendar")}</Link></div>
          {data.upcoming.length === 0 ? <p className="text-sm text-subtle">{t("لا توجد منشورات مجدولة.", "Nothing scheduled.")}</p> :
            <div className="space-y-2">{data.upcoming.map((p: any) => (
              <Link key={p.id} href={`/posts/${p.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted">
                <div className="flex -space-x-1 rtl:space-x-reverse">{[...new Set(p.variants.map((v: any) => v.platform))].map((pp: any) => <PlatformIcon key={pp} platform={pp} size={20} />)}</div>
                <span className="flex-1 truncate text-sm">{p.title}</span><span className="text-xs text-subtle">{new Date(p.scheduledAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</span>
              </Link>))}</div>}
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">{t("آخر النشاطات", "Recent activity")}</h3>
          {data.activity.length === 0 ? <p className="text-sm text-subtle">{t("لا يوجد نشاط بعد.", "No activity yet.")}</p> :
            <ol className="space-y-2.5">{data.activity.map((a: any) => <li key={a.id} className="flex gap-2 text-sm"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /><div className="min-w-0"><div className="truncate"><b className="font-medium">{a.user?.name ?? t("النظام", "System")}</b> · <span className="text-subtle">{a.action}</span></div><div className="text-[11px] text-subtle">{new Date(a.createdAt).toLocaleString(locale)}</div></div></li>)}</ol>}
        </Card>
      </div>

      {data.failures.length > 0 && <Card className="mt-4 border-danger/30 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-danger"><AlertTriangle className="h-4 w-4" />{t("تنبيهات فشل النشر", "Publishing failures")}</h3>
        <div className="space-y-2">{data.failures.map((f: any) => <Link key={f.id} href={`/posts/${f.post.id}`} className="flex items-start gap-3 rounded-xl bg-danger/5 px-3 py-2 hover:bg-danger/10"><PlatformIcon platform={f.platform} size={20} /><div className="min-w-0 flex-1"><div className="text-sm font-medium">{f.post.title}</div><div className="truncate text-xs text-subtle">{f.lastError}</div></div><StatusBadge status="failed" /></Link>)}</div>
      </Card>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">{t("أفضل المنشورات أداءً", "Top performing posts")}</h3>
          {data.summary.top.length === 0 ? <p className="text-sm text-subtle">{t("ستظهر هنا بعد جمع المقاييس.", "Appears after metrics are collected.")}</p> :
            <div className="divide-y divide-border">{data.summary.top.slice(0, 5).map((p: any) => <div key={p.variantId} className="flex items-center gap-3 py-2.5"><PlatformIcon platform={p.platform} size={22} /><Link href={`/posts/${p.postId}`} className="flex-1 truncate text-sm hover:text-primary">{p.title}</Link><span className="text-xs text-subtle">{n(p.views)} <Eye className="inline h-3 w-3" /></span><span className="w-14 text-end text-sm font-semibold">{n(p.engagement)}</span></div>)}</div>}
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">{t("المتابعون حسب الحساب", "Followers by account")}</h3>
          {data.accounts.length === 0 ? <p className="text-sm text-subtle">—</p> :
            <BarsChart data={data.accounts.filter((a: any) => a.followers != null).map((a: any) => ({ name: a.displayName.slice(0, 14), followers: a.followers }))} x="name" y="followers" label={t("المتابعون", "Followers")} height={200} />}
        </Card>
      </div>
    </>}
  </div>;
}
