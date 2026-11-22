"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Users2, Send, CalendarDays, Eye, FileText, Megaphone, Heart, AlertTriangle, Sparkles, Clock, Activity, TrendingUp, TrendingDown, Minus, Plus, Plug, UserPlus, Radio, Palette, Clapperboard, Bot, CircleAlert, Info, ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, Skeleton, EmptyState, ErrorBox, Button, PageHeader, Tabs, useToast } from "@/components/ui";
import { RangePicker, rangeQuery, type RangeValue } from "@/components/range-picker";
import { CompareChart } from "@/components/charts";
import { PlatformIcon, PLATFORM_LABEL } from "@/components/platform-icon";
import { usePerms } from "@/components/shell";
import { Markdown } from "@/components/markdown";
import { api } from "@/lib/client";

const n = (v: number | null | undefined) => (v == null ? "—" : Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v));
const pctFmt = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

const ACTIONS: Record<string, [string, string]> = {
  "auth.register": ["أنشأ الحساب", "created the account"], "auth.mfa_enable": ["فعّل التحقق بخطوتين", "enabled 2FA"], "auth.password_change": ["غيّر كلمة المرور", "changed password"],
  "post.create": ["أنشأ منشورًا", "created a post"], "post.update": ["عدّل منشورًا", "edited a post"], "post.delete": ["حذف منشورًا", "deleted a post"], "post.schedule": ["جدول منشورًا", "scheduled a post"],
  "post.publish_now": ["بدأ نشر منشور", "started publishing"], "post.unschedule": ["ألغى جدولة منشور", "unscheduled a post"], "post.submit": ["أرسل منشورًا للمراجعة", "submitted for review"],
  "post.approve": ["اعتمد منشورًا", "approved a post"], "post.changes_requested": ["طلب تعديلات", "requested changes"], "post.reject": ["رفض منشورًا", "rejected a post"], "post.move": ["نقل موعد منشور", "moved a post"], "post.manual_confirm": ["أكد نشرًا يدويًا", "confirmed manual publish"],
  "account.connect": ["ربط حسابًا", "connected an account"], "account.disconnect": ["فصل حسابًا", "disconnected an account"], "media.upload": ["رفع ملفات", "uploaded files"], "media.delete": ["حذف ملفًا", "deleted a file"],
  "campaign.create": ["أنشأ حملة", "created a campaign"], "campaign.update": ["عدّل حملة", "edited a campaign"], "campaign.apply_plan": ["حوّل خطة حملة إلى مسودات", "applied a campaign plan"], "campaign.delete": ["حذف حملة", "deleted a campaign"],
  "brand.create": ["أنشأ هوية تجارية", "created a brand kit"], "brand.update": ["عدّل الهوية التجارية", "updated the brand kit"], "video.render": ["بدأ إخراج فيديو", "started a video render"],
  "settings.update": ["عدّل الإعدادات", "updated settings"], "settings.ai_update": ["عدّل إعدادات الذكاء الاصطناعي", "updated AI settings"], "integration.app_update": ["أعدّ تطبيق تكامل", "configured an integration"],
  "user.add": ["أضاف عضوًا", "added a member"], "user.remove": ["أزال عضوًا", "removed a member"], "user.role_change": ["غيّر دور عضو", "changed a role"], "inbox.reply": ["ردّ على تعليق", "replied to a comment"],
  "email.campaign_create": ["أنشأ حملة بريدية", "created an email campaign"], "email.send": ["أرسل حملة بريدية", "sent an email campaign"], "email.schedule": ["جدول حملة بريدية", "scheduled an email campaign"], "email.contacts_import": ["استورد جهات اتصال", "imported contacts"],
};
const entityLink = (a: any) => a.entityId && ({ Post: `/posts/${a.entityId}`, Campaign: `/campaigns/${a.entityId}`, VideoProject: `/video/${a.entityId}`, MediaAsset: "/media", BrandKit: "/brand", EmailCampaign: "/email" } as Record<string, string>)[a.entityType];

function Delta({ change, invert }: { change: number | null | undefined; invert?: boolean }) {
  const t = useT();
  if (change === undefined) return null;
  if (change === null) return <span className="text-xs text-subtle">{t("جديد", "new")}</span>;
  const up = change > 0.0005, down = change < -0.0005; const good = invert ? down : up;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return <span className={clsx("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", up || down ? (good ? "text-success" : "text-danger") : "text-subtle")} title={t("مقارنة بالفترة السابقة", "vs previous period")}><Icon className="h-3.5 w-3.5" />{Math.abs(change * 100).toFixed(change !== 0 && Math.abs(change) < 0.1 ? 1 : 0)}%</span>;
}

function Kpi({ label, value, icon, change, sub, href }: { label: string; value: React.ReactNode; icon: React.ReactNode; change?: number | null; sub?: React.ReactNode; href?: string }) {
  const body = <><div className="flex items-center justify-between gap-2"><span className="truncate text-xs text-subtle">{label}</span><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span></div>
    <div className="mt-2 flex items-baseline gap-2"><span className="text-2xl font-bold tabular-nums">{value}</span><Delta change={change} /></div>
    {sub && <div className="mt-1 truncate text-xs text-subtle">{sub}</div>}</>;
  return href ? <Link href={href} className="card block p-4 transition hover:-translate-y-0.5 hover:shadow-pop">{body}</Link> : <Card className="p-4">{body}</Card>;
}

export default function Dashboard() {
  const t = useT(); const locale = useLocale(); const toast = useToast(); const can = usePerms();
  const [range, setRange] = useState<RangeValue>({ range: "month" });
  const { data, error, loading, reload } = useApi<any>(`/api/dashboard?${rangeQuery(range)}`);
  const [metric, setMetric] = useState<"engagement" | "views" | "published" | "followers">("engagement");
  const [ai, setAi] = useState<{ summary: string; insights: string[]; recommendations: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false); const [showAllAlerts, setShowAllAlerts] = useState(false);
  const pl = (p: string) => t(PLATFORM_LABEL[p]?.[0] ?? p, PLATFORM_LABEL[p]?.[1] ?? p);
  const fmtX = useMemo(() => (v: string) => { const d = new Date(v); return data?.unit === "hour" ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString(locale, { day: "numeric", month: "short" }); }, [data?.unit, locale]);

  async function aiSummary() {
    setAiLoading(true);
    try { setAi(await api(`/api/analytics/insights?${rangeQuery(range)}`, { method: "POST", body: {} })); } catch (e) { toast.error(e); } finally { setAiLoading(false); }
  }
  const alertText = (a: any): [string, string] => ({
    account: [`الحساب ${a.title} يحتاج إعادة ربط`, `${a.title} needs to be reconnected`], token: [`صلاحية اتصال ${a.title} تنتهي قريبًا ولم يُجدد`, `${a.title}'s token expires soon and hasn't refreshed`],
    publish_failed: [`فشل نشر "${a.title}"`, `Publishing "${a.title}" failed`], overdue: [`${a.title} منشور مجدول تجاوز موعده — تأكد من تشغيل العامل`, `${a.title} scheduled post(s) overdue — check the worker is running`],
    manual: [`"${a.title}" بانتظار النشر اليدوي`, `"${a.title}" awaits manual publishing`], review: [`${a.title} منشور بانتظار اعتمادك`, `${a.title} post(s) awaiting your approval`],
    email: [`مشكلة في الحملة البريدية "${a.title}"`, `Problem with email campaign "${a.title}"`], video: [`فشل إخراج الفيديو "${a.title}"`, `Video render "${a.title}" failed`],
  } as Record<string, [string, string]>)[a.kind] ?? [a.title, a.title];

  const metricMeta = {
    engagement: { y: "engagement", prev: "prevEngagement", label: t("التفاعل", "Engagement"), hint: t("إعجابات + تعليقات + مشاركات + حفظ للمنشورات المنشورة في الفترة", "Likes + comments + shares + saves on posts published in the period") },
    views: { y: "views", prev: "prevViews", label: t("المشاهدات والظهور", "Views & impressions"), hint: t("مشاهدات/ظهور المنشورات حسب وقت النشر", "Post views/impressions by publish time") },
    published: { y: "published", prev: "prevPublished", label: t("المنشورات المنشورة", "Published posts"), hint: t("عدد المنشورات المؤكد نشرها على المنصات", "Posts confirmed as published by the platforms") },
    followers: { y: "followers", prev: undefined, label: t("إجمالي المتابعين", "Total followers"), hint: t("آخر عدد متابعين معروف لكل حساب (من المزامنة)", "Last known follower count per account (from syncs)") },
  }[metric];
  const seriesHasData = data?.series?.some((s: any) => (metric === "followers" ? s.followers != null : s[metric] > 0 || (metricMeta.prev && s[metricMeta.prev] > 0)));
  const alerts: any[] = data?.alerts ?? [];
  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 4);

  return <div>
    <PageHeader title={t("لوحة التحكم", "Dashboard")} subtitle={t("نظرة شاملة على حساباتك ومحتواك وأدائك الفعلي", "An overview of your accounts, content and real performance")}
      actions={<><RangePicker value={range} onChange={setRange} /><button className="btn-ghost h-9 w-9 p-0" onClick={() => reload(true)} title={t("تحديث", "Refresh")}><RefreshCw className="h-4 w-4" /></button>{can("content.create") && <Link href="/studio" className="btn-primary"><Plus className="h-4 w-4" />{t("محتوى جديد", "New content")}</Link>}</>} />
    {error ? <ErrorBox error={error} onRetry={reload} /> : null}
    {loading || !data ? <div className="space-y-4"><div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div><div className="grid grid-cols-2 gap-4 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-80" /></div> : <div className="space-y-4">

      {alerts.length > 0 && <Card className="p-4 animate-in">
        <div className="mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /><h3 className="text-sm font-semibold">{t("تنبيهات تحتاج انتباهك", "Alerts needing attention")}</h3><span className="chip bg-muted text-subtle">{alerts.length}</span></div>
        <div className="grid gap-2 md:grid-cols-2">{visibleAlerts.map((a) => { const [ar, en] = alertText(a); const Icon = a.severity === "critical" ? CircleAlert : a.severity === "warning" ? AlertTriangle : Info;
          return <Link key={a.id} href={a.link} className={clsx("flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition hover:shadow-card", a.severity === "critical" ? "border-danger/30 bg-danger/5" : a.severity === "warning" ? "border-warning/30 bg-warning/5" : "border-primary/20 bg-primary/5")}>
            <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", a.severity === "critical" ? "text-danger" : a.severity === "warning" ? "text-warning" : "text-primary")} />
            <div className="min-w-0 flex-1"><div className="font-medium leading-6">{t(ar, en)}</div>{a.body && a.kind !== "token" && <div className="line-clamp-1 text-xs text-subtle">{a.body}</div>}{a.kind === "token" && a.body && <div className="text-xs text-subtle">{new Date(a.body).toLocaleString(locale)}</div>}</div>
          </Link>; })}</div>
        {alerts.length > 4 && <button className="mt-2 flex items-center gap-1 text-xs text-primary" onClick={() => setShowAllAlerts(!showAllAlerts)}><ChevronDown className={clsx("h-3.5 w-3.5 transition", showAllAlerts && "rotate-180")} />{showAllAlerts ? t("عرض أقل", "Show less") : t(`عرض الكل (${alerts.length})`, `Show all (${alerts.length})`)}</button>}
      </Card>}

      {data.counts.accounts === 0 && <Card className="flex flex-col items-start gap-4 bg-gradient-to-br from-primary/10 to-transparent p-6 sm:flex-row sm:items-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white"><Plug /></div>
        <div className="flex-1"><h3 className="font-semibold">{t("ابدأ بربط حساباتك", "Start by connecting your accounts")}</h3><p className="text-sm text-subtle">{t("تظهر الإحصاءات فقط بعد ربط الحسابات ومزامنة بياناتها الفعلية من المنصات — لا نعرض أرقامًا تقديرية.", "Statistics appear only after you connect accounts and sync their real data — we never show estimates.")}</p></div>
        <Link href="/onboarding" className="btn-outline">{t("دليل البدء", "Setup guide")}</Link><Link href="/accounts" className="btn-primary">{t("ربط حساب", "Connect account")}</Link>
      </Card>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi href="/accounts" label={t("الحسابات المرتبطة", "Connected accounts")} value={data.counts.accounts} icon={<Users2 className="h-4 w-4" />} sub={t(`${n(data.kpis.totalFollowers)} متابع`, `${n(data.kpis.totalFollowers)} followers`)} />
        <Kpi href="/posts?status=published,partially_published" label={t("منشورات منشورة", "Published")} value={data.counts.published} change={data.kpis.published.change} icon={<Send className="h-4 w-4" />} sub={t("خلال الفترة", "In period")} />
        <Kpi href="/calendar" label={t("مجدولة", "Scheduled")} value={data.counts.scheduled} icon={<CalendarDays className="h-4 w-4" />} sub={data.upcoming[0] ? t("التالي: ", "Next: ") + new Date(data.upcoming[0].scheduledAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : undefined} />
        <Kpi href="/posts?status=in_review" label={t("قيد المراجعة", "In review")} value={data.counts.inReview} icon={<Clock className="h-4 w-4" />} />
        <Kpi href="/posts?status=idea,draft,designing" label={t("المسودات", "Drafts")} value={data.counts.drafts} icon={<FileText className="h-4 w-4" />} />
        <Kpi href="/campaigns" label={t("الحملات", "Campaigns")} value={data.counts.campaigns} icon={<Megaphone className="h-4 w-4" />} sub={t(`${data.counts.activeCampaigns} نشطة`, `${data.counts.activeCampaigns} active`)} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label={t("إجمالي التفاعل", "Total engagement")} value={data.kpis.engagement.measured ? n(data.kpis.engagement.value) : "—"} change={data.kpis.engagement.measured ? data.kpis.engagement.change : undefined} icon={<Heart className="h-4 w-4" />} sub={t(`السابقة: ${n(data.kpis.engagement.prev)}`, `Previous: ${n(data.kpis.engagement.prev)}`)} />
        <Kpi label={t("المشاهدات والظهور", "Views & impressions")} value={data.kpis.views.measured ? n(data.kpis.views.value) : "—"} change={data.kpis.views.measured ? data.kpis.views.change : undefined} icon={<Eye className="h-4 w-4" />} sub={t(`السابقة: ${n(data.kpis.views.prev)}`, `Previous: ${n(data.kpis.views.prev)}`)} />
        <Kpi label={t("الوصول", "Reach")} value={data.kpis.reach.measured && data.kpis.reach.value ? n(data.kpis.reach.value) : "—"} change={data.kpis.reach.measured && data.kpis.reach.value ? data.kpis.reach.change : undefined} icon={<Radio className="h-4 w-4" />} sub={t("حيث توفره المنصة (Instagram)", "Where provided (Instagram)")} />
        <Kpi label={t("نمو المتابعين", "Follower growth")} value={data.kpis.followersGained.measured ? `${data.kpis.followersGained.value > 0 ? "+" : ""}${n(data.kpis.followersGained.value)}` : "—"} change={data.kpis.followersGained.measured ? data.kpis.followersGained.change : undefined} icon={<UserPlus className="h-4 w-4" />} sub={t(`الإجمالي ${n(data.kpis.totalFollowers)}`, `Total ${n(data.kpis.totalFollowers)}`)} />
        <Kpi label={t("معدل التفاعل", "Engagement rate")} value={pctFmt(data.kpis.engagementRate.value)} change={data.kpis.engagementRate.value != null && data.kpis.engagementRate.prev ? (data.kpis.engagementRate.value - data.kpis.engagementRate.prev) / data.kpis.engagementRate.prev : undefined} icon={<TrendingUp className="h-4 w-4" />} sub={t("التفاعل ÷ المشاهدات", "Engagement ÷ views")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-semibold">{metricMeta.label}</h3><p className="text-xs text-subtle">{metricMeta.hint} · {data.unit === "hour" ? t("بالساعة", "hourly") : t("يوميًا", "daily")}</p>
              {metricMeta.prev && (() => { const cur = data.series.reduce((a: number, s: any) => a + s[metricMeta.y], 0), prev = data.series.reduce((a: number, s: any) => a + s[metricMeta.prev!], 0);
                return <div className="mt-2 flex items-baseline gap-3"><span className="text-xl font-bold tabular-nums">{n(cur)}</span><Delta change={prev > 0 ? (cur - prev) / prev : cur > 0 ? null : 0} /><span className="text-xs text-subtle">{t("الفترة السابقة", "Previous period")}: {n(prev)}</span></div>; })()}</div>
            <Tabs value={metric} onChange={setMetric} items={[{ value: "engagement", label: t("التفاعل", "Engagement") }, { value: "views", label: t("المشاهدات", "Views") }, { value: "published", label: t("النشر", "Published") }, { value: "followers", label: t("المتابعون", "Followers") }]} />
          </div>
          {seriesHasData ? <CompareChart key={metric} kind={metric === "followers" ? "area" : "bar"} data={data.series} x="t" y={metricMeta.y} label={metricMeta.label} prevLabel={t("الفترة السابقة", "previous period")} fmtX={fmtX} /> :
            <EmptyState icon={<Activity />} title={t("لا توجد بيانات لهذه الفترة", "No data for this period")} body={metric === "followers" ? t("يُسجل عدد المتابعين عند كل مزامنة للحسابات (تلقائيًا كل 6 ساعات).", "Follower counts are recorded on every account sync (automatically every 6 hours).") : t("تُجمع المقاييس تلقائيًا كل 6 ساعات للمنشورات التي نُشرت عبر المنصة.", "Metrics are collected every 6 hours for posts published through the platform.")} />}
        </Card>
        <Card className="flex flex-col p-5">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{t("الملخص الذكي", "AI summary")}</h3><Sparkles className="h-4 w-4 text-primary" /></div>
          {ai ? <div className="flex-1 space-y-3 text-sm leading-7"><Markdown text={ai.summary} />{ai.insights.length > 0 && <div><div className="text-xs font-semibold text-subtle">{t("ملاحظات", "Insights")}</div><ul className="list-disc space-y-1 ps-5">{ai.insights.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
            {ai.recommendations.length > 0 && <div><div className="text-xs font-semibold text-subtle">{t("توصيات", "Recommendations")}</div><ul className="list-disc space-y-1 ps-5">{ai.recommendations.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
            <div className="flex gap-3 text-xs"><Link href="/analytics" className="text-primary">{t("التحليل الكامل ←", "Full analysis →")}</Link><button className="text-subtle" onClick={aiSummary} disabled={aiLoading}>{t("إعادة التوليد", "Regenerate")}</button></div></div> :
            <div className="flex flex-1 flex-col text-sm text-subtle"><p className="mb-4">{data.hasData ? t("ملخص لأدائك الفعلي في الفترة المحددة مع ملاحظات وتوصيات عملية.", "A summary of your actual performance in this period, with insights and actions.") : t("سيتوفر الملخص بعد مزامنة بيانات أداء فعلية لهذه الفترة.", "Available once real performance data is synced for this period.")}</p>
              {aiLoading ? <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-4/6" /></div> :
                <Button variant="outline" className="self-start" onClick={aiSummary} disabled={!data.hasData || !can("reports.view")}><Sparkles className="h-4 w-4" />{t("توليد الملخص", "Generate summary")}</Button>}
              <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                {[["/assistant", Bot, "المساعد الذكي", "Assistant"], ["/design/new", Palette, "تصميم جديد", "New design"], ["/video/new", Clapperboard, "فيديو جديد", "New video"], ["/campaigns", Megaphone, "حملة جديدة", "New campaign"]].map(([h, I, a, e]: any) => <Link key={h} href={h} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-fg transition hover:border-primary hover:bg-primary/5"><I className="h-4 w-4 text-primary" />{t(a, e)}</Link>)}
              </div></div>}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3"><h3 className="font-semibold">{t("ملخص أداء كل منصة", "Performance by platform")}</h3><Link href="/analytics" className="text-xs text-primary">{t("التحليلات", "Analytics")}</Link></div>
        {data.platforms.length === 0 ? <p className="px-5 pb-5 text-sm text-subtle">{t("لا توجد حسابات مرتبطة.", "No connected accounts.")}</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-y border-border bg-muted/40 text-xs text-subtle">{[t("المنصة", "Platform"), t("المتابعون", "Followers"), t("النمو", "Growth"), t("منشور", "Published"), t("المشاهدات", "Views"), t("الوصول", "Reach"), t("التفاعل", "Engagement"), t("معدل التفاعل", "Eng. rate")].map((h, i) => <th key={i} className={clsx("px-4 py-2 font-medium", i === 0 ? "text-start" : "text-end")}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">{data.platforms.map((p: any) => <tr key={p.platform} className="hover:bg-muted/40">
              <td className="px-4 py-2.5"><div className="flex items-center gap-2"><PlatformIcon platform={p.platform} size={22} /><span className="font-medium">{pl(p.platform)}</span><span className="text-xs text-subtle">({p.accounts})</span>{p.needsAttention && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}</div></td>
              <td className="px-4 text-end tabular-nums">{p.followers ? n(p.followers) : "—"}</td>
              <td className={clsx("px-4 text-end tabular-nums", p.followersGained > 0 ? "text-success" : p.followersGained < 0 ? "text-danger" : "")}>{p.followersGained == null ? "—" : `${p.followersGained > 0 ? "+" : ""}${n(p.followersGained)}`}</td>
              <td className="px-4 text-end tabular-nums">{p.published}</td>
              <td className="px-4 text-end tabular-nums">{p.measured ? n(p.views) : "—"}</td>
              <td className="px-4 text-end tabular-nums">{p.measured && p.reach ? n(p.reach) : "—"}</td>
              <td className="px-4 text-end font-semibold tabular-nums">{p.measured ? n(p.engagement) : "—"}</td>
              <td className="px-4 text-end tabular-nums">{pctFmt(p.engagementRate)}</td>
            </tr>)}</tbody></table></div>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{t("أفضل المنشورات أداءً", "Top performing posts")}</h3></div>
          {data.top.length === 0 ? <p className="text-sm text-subtle">{t("ستظهر هنا بعد جمع المقاييس للمنشورات المنشورة.", "Appears after metrics are collected for published posts.")}</p> :
            <ol className="space-y-1">{data.top.map((p: any, i: number) => <li key={p.variantId} className="flex items-center gap-2.5 rounded-lg px-1.5 py-2 hover:bg-muted/50">
              <span className="w-4 text-center text-xs font-semibold text-subtle">{i + 1}</span><PlatformIcon platform={p.platform} size={20} />
              <Link href={`/posts/${p.postId}`} className="min-w-0 flex-1 truncate text-sm hover:text-primary">{p.title}</Link>
              <span className="text-xs tabular-nums text-subtle"><Eye className="me-0.5 inline h-3 w-3" />{n(p.views)}</span><span className="w-12 text-end text-sm font-semibold tabular-nums">{n(p.engagement)}</span>
              {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-subtle hover:text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>}</li>)}</ol>}
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{t("المنشورات القادمة", "Upcoming posts")}</h3><Link href="/calendar" className="text-xs text-primary">{t("التقويم", "Calendar")}</Link></div>
          {data.upcoming.length === 0 ? <div className="text-sm text-subtle"><p>{t("لا توجد منشورات مجدولة.", "Nothing scheduled.")}</p>{can("content.create") && <Link href="/posts/new" className="mt-2 inline-block text-primary">+ {t("جدولة منشور", "Schedule a post")}</Link>}</div> :
            <div className="space-y-1">{data.upcoming.map((p: any) => { const d = new Date(p.scheduledAt); return (
              <Link key={p.id} href={`/posts/${p.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted">
                <div className="w-11 shrink-0 rounded-lg bg-primary/10 py-1 text-center text-primary"><div className="text-[10px] leading-3">{d.toLocaleDateString(locale, { month: "short" })}</div><div className="text-sm font-bold leading-5">{d.getDate()}</div></div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm">{p.title}</div><div className="flex items-center gap-1 text-xs text-subtle">{d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}<span className="ms-1 flex gap-0.5">{[...new Set(p.variants.map((v: any) => v.platform))].map((pp: any) => <PlatformIcon key={pp} platform={pp} size={14} />)}</span></div></div>
              </Link>); })}</div>}
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">{t("آخر النشاطات", "Recent activity")}</h3>
          {data.activity.length === 0 ? <p className="text-sm text-subtle">{t("لا يوجد نشاط بعد.", "No activity yet.")}</p> :
            <ol className="relative space-y-3 border-s border-border ps-4">{data.activity.slice(0, 7).map((a: any) => { const l = ACTIONS[a.action]; const href = entityLink(a); const text = <><b className="font-medium">{a.user?.name ?? t("النظام", "System")}</b> <span className="text-subtle">{l ? t(l[0], l[1]) : a.action}</span></>;
              return <li key={a.id} className="relative text-sm"><span className="absolute -start-[21px] top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-surface" />
                <div className="leading-6">{href ? <Link href={href} className="hover:text-primary">{text}</Link> : text}</div><div className="text-[11px] text-subtle">{new Date(a.createdAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</div></li>; })}</ol>}
        </Card>
      </div>
    </div>}
  </div>;
}
