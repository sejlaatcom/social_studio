"use client";
import { useState } from "react";
import Link from "next/link";
import { BarChart3, Eye, Heart, MessageCircle, Share2, Bookmark, TrendingUp, Sparkles, Download, Users2 } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, StatCard, Skeleton, ErrorBox, EmptyState, Button, useToast } from "@/components/ui";
import { RangePicker, rangeQuery, type RangeValue } from "@/components/range-picker";
import { TrendChart, BarsChart, MultiLine } from "@/components/charts";
import { PlatformIcon, PLATFORM_LABEL } from "@/components/platform-icon";
import { api } from "@/lib/client";

const n = (v: number | null | undefined) => (v == null ? "—" : Intl.NumberFormat("en", { notation: "compact" }).format(v));
const TYPES: Record<string, [string, string]> = { educational: ["تعليمي", "Educational"], promotional: ["ترويجي", "Promotional"], engagement: ["تفاعلي", "Engagement"], announcement: ["إعلان", "Announcement"], behind_the_scenes: ["خلف الكواليس", "BTS"], testimonial: ["آراء", "Testimonial"], entertainment: ["ترفيهي", "Entertainment"], unspecified: ["غير محدد", "Unspecified"] };

export default function Analytics() {
  const t = useT(); const locale = useLocale(); const toast = useToast();
  const [range, setRange] = useState<RangeValue>({ range: "month" }); const [platform, setPlatform] = useState("");
  const { data, loading, error, reload } = useApi<any>(`/api/analytics?${rangeQuery(range)}&platform=${platform}`);
  const [ai, setAi] = useState<any>(null); const [busy, setBusy] = useState(false);
  async function insights() { setBusy(true); try { setAi(await api(`/api/analytics/insights?${rangeQuery(range)}&platform=${platform}`, { method: "POST", body: {} })); } catch (e) { toast.error(e); } finally { setBusy(false); } }
  function exportCsv() {
    const rows = [["platform", "title", "published_at", "views", "likes", "comments", "shares", "saves", "engagement", "url"], ...data.top.map((p: any) => [p.platform, `"${(p.title ?? "").replace(/"/g, '""')}"`, p.publishedAt, p.views, p.likes ?? "", p.comments ?? "", p.shares ?? "", p.saves ?? "", p.engagement, p.url ?? ""])];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" })); a.download = `report-${range.range}.csv`; a.click();
  }
  const pl = (p: string) => t(PLATFORM_LABEL[p]?.[0] ?? p, PLATFORM_LABEL[p]?.[1] ?? p);
  const growthSeries = (() => {
    if (!data?.growth) return { rows: [], series: [] };
    const map = new Map<string, any>(); const series = data.growth.filter((g: any) => g.series.length > 1).slice(0, 8).map((g: any) => ({ key: g.accountId, label: `${pl(g.platform)} · ${g.name}` }));
    for (const g of data.growth) for (const s of g.series) { const d = String(s.at).slice(0, 10); const r = map.get(d) ?? { date: d }; r[g.accountId] = s.followers; map.set(d, r); }
    return { rows: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)), series };
  })();

  return <div>
    <PageHeader icon={<BarChart3 />} title={t("تحليل الأداء", "Analytics")} subtitle={t("بيانات فعلية مسحوبة من واجهات المنصات الرسمية", "Real data pulled from the platforms' official APIs")}
      actions={<><RangePicker value={range} onChange={setRange} /><select className="input w-auto" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">{t("كل المنصات", "All platforms")}</option>{Object.keys(PLATFORM_LABEL).map((p) => <option key={p} value={p}>{pl(p)}</option>)}</select>{data?.hasData && <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button>}</>} />
    {error ? <ErrorBox error={error} onRetry={reload} /> : loading || !data ? <div className="grid grid-cols-2 gap-4 md:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div> : !data.hasData ?
      <EmptyState icon={<BarChart3 />} title={t("لا توجد بيانات أداء لهذه الفترة", "No performance data for this period")} body={t("تُجمع المقاييس من المنصات كل 6 ساعات (أو عند المزامنة اليدوية من صفحة الحسابات) للمنشورات التي نُشرت عبر المنصة. لا نعرض أي أرقام تقديرية.", "Metrics are collected every 6 hours (or on manual sync from Accounts) for posts published through the platform. We never show estimated numbers.")} action={<Link href="/accounts" className="btn-primary">{t("الحسابات والمزامنة", "Accounts & sync")}</Link>} /> : <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t("المشاهدات/الظهور", "Views/impressions")} value={n(data.totals.views + data.totals.impressions)} icon={<Eye className="h-4 w-4" />} />
        <StatCard label={t("الوصول", "Reach")} value={n(data.totals.reach)} icon={<Users2 className="h-4 w-4" />} />
        <StatCard label={t("الإعجابات", "Likes")} value={n(data.totals.likes)} icon={<Heart className="h-4 w-4" />} tone="danger" />
        <StatCard label={t("التعليقات", "Comments")} value={n(data.totals.comments)} icon={<MessageCircle className="h-4 w-4" />} tone="success" />
        <StatCard label={t("المشاركات", "Shares")} value={n(data.totals.shares)} icon={<Share2 className="h-4 w-4" />} tone="warning" />
        <StatCard label={t("معدل التفاعل", "Engagement rate")} value={data.totals.engagementRate == null ? "—" : (data.totals.engagementRate * 100).toFixed(2) + "%"} icon={<TrendingUp className="h-4 w-4" />} hint={t(`${data.totals.posts} منشور مقاس`, `${data.totals.posts} measured posts`)} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2"><h3 className="mb-3 font-semibold">{t("التفاعل حسب تاريخ النشر", "Engagement by publish date")}</h3><TrendChart data={data.daily} x="date" y="engagement" label={t("التفاعل", "Engagement")} /></Card>
        <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{t("تحليل الذكاء الاصطناعي", "AI analysis")}</h3><Sparkles className="h-4 w-4 text-primary" /></div>
          {ai ? <div className="space-y-3 text-sm leading-7"><p>{ai.summary}</p><div><b className="text-xs text-subtle">{t("ملاحظات", "Insights")}</b><ul className="list-disc ps-5">{ai.insights.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div><div><b className="text-xs text-subtle">{t("توصيات", "Recommendations")}</b><ul className="list-disc ps-5">{ai.recommendations.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div></div> :
            <><p className="mb-3 text-sm text-subtle">{t("تحليل مبني على أرقامك الفعلية فقط مع توصيات عملية.", "Analysis based only on your real numbers, with actionable recommendations.")}</p><Button variant="outline" onClick={insights} loading={busy}><Sparkles className="h-4 w-4" />{t("حلّل", "Analyze")}</Button></>}
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5"><h3 className="mb-3 font-semibold">{t("التفاعل حسب المنصة", "Engagement by platform")}</h3><BarsChart data={Object.entries(data.byPlatform).map(([p, v]: any) => ({ name: pl(p), engagement: v.engagement }))} x="name" y="engagement" label={t("التفاعل", "Engagement")} /></Card>
        <Card className="p-5"><h3 className="mb-3 font-semibold">{t("متوسط التفاعل حسب نوع المحتوى", "Avg engagement by content type")}</h3><BarsChart data={Object.entries(data.byType).map(([k, v]: any) => ({ name: t(TYPES[k]?.[0] ?? k, TYPES[k]?.[1] ?? k), avg: Math.round(v.engagement / v.posts) }))} x="name" y="avg" label={t("متوسط التفاعل", "Avg engagement")} /></Card>
      </div>
      {growthSeries.series.length > 0 && <Card className="mt-4 p-5"><h3 className="mb-3 font-semibold">{t("نمو المتابعين", "Follower growth")}</h3><MultiLine data={growthSeries.rows} x="date" series={growthSeries.series} /></Card>}
      <Card className="mt-4 overflow-x-auto p-5"><h3 className="mb-3 font-semibold">{t("أفضل المنشورات", "Top posts")}</h3>
        <table className="w-full min-w-[640px] text-sm"><thead><tr className="text-xs text-subtle">{[t("المنشور", "Post"), t("التاريخ", "Date"), t("مشاهدات", "Views"), t("إعجابات", "Likes"), t("تعليقات", "Comments"), t("مشاركات", "Shares"), t("حفظ", "Saves"), t("التفاعل", "Eng.")].map((h) => <th key={h} className="pb-2 text-start font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">{data.top.map((p: any) => <tr key={p.variantId}><td className="py-2"><Link href={`/posts/${p.postId}`} className="flex items-center gap-2 hover:text-primary"><PlatformIcon platform={p.platform} size={18} /><span className="max-w-[260px] truncate">{p.title}</span></Link></td><td className="text-xs text-subtle">{new Date(p.publishedAt).toLocaleDateString(locale)}</td>{[p.views, p.likes, p.comments, p.shares, p.saves].map((x, i) => <td key={i} className="tabular-nums">{n(x)}</td>)}<td className="font-semibold tabular-nums">{n(p.engagement)}</td></tr>)}</tbody></table>
      </Card>
    </>}
  </div>;
}
