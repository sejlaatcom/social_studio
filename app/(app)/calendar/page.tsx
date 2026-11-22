"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import clsx from "clsx";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, Tabs, Spinner, useToast, ErrorBox } from "@/components/ui";
import { PlatformIcon } from "@/components/platform-icon";
import { StatusBadge, STATUS_LABELS } from "@/components/status";
import { api } from "@/lib/client";

const day0 = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a: Date, b: Date) => day0(a).getTime() === day0(b).getTime();
const tone: Record<string, string> = { published: "border-s-success", partially_published: "border-s-warning", failed: "border-s-danger", scheduled: "border-s-primary", in_review: "border-s-warning", publishing: "border-s-warning" };

export default function Calendar() {
  const t = useT(); const locale = useLocale(); const toast = useToast(); const router = useRouter();
  const [view, setView] = useState<"month" | "week" | "day" | "list">("month");
  const [cursor, setCursor] = useState(day0(new Date()));
  const [platform, setPlatform] = useState(""); const [campaign, setCampaign] = useState(""); const [statusF, setStatusF] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const range = useMemo(() => {
    if (view === "month") { const s = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const start = addDays(s, -((s.getDay() + 1) % 7)); return { start, days: 42 }; }
    if (view === "week") { const start = addDays(cursor, -((cursor.getDay() + 1) % 7)); return { start, days: 7 }; }
    if (view === "day") return { start: cursor, days: 1 };
    return { start: cursor, days: 31 };
  }, [view, cursor]);
  const end = addDays(range.start, range.days);
  const { data, loading, error, reload } = useApi<any[]>(`/api/posts?from=${range.start.toISOString()}&to=${end.toISOString()}&platform=${platform}&campaignId=${campaign}&status=${statusF}&take=500`);
  const { data: campaigns } = useApi<any[]>("/api/campaigns");
  const posts = (data ?? []).filter((p) => p.scheduledAt || p.publishedAt);
  const dateOf = (p: any) => new Date(p.scheduledAt ?? p.publishedAt);
  const forDay = (d: Date) => posts.filter((p) => sameDay(dateOf(p), d)).sort((a, b) => +dateOf(a) - +dateOf(b));

  async function drop(d: Date) {
    if (!drag) return; const p = posts.find((x) => x.id === drag); setDrag(null); if (!p) return;
    const old = dateOf(p); const at = new Date(d); at.setHours(old.getHours(), old.getMinutes(), 0, 0);
    if (sameDay(old, at)) return;
    try { await api(`/api/posts/${p.id}/date`, { method: "PATCH", body: { at: at.toISOString() } }); toast.success(t("تم نقل المنشور", "Post moved")); reload(true); } catch (e) { toast.error(e); }
  }
  function shift(n: number) { if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1)); else setCursor(addDays(cursor, n * (view === "week" ? 7 : view === "day" ? 1 : 31))); }
  const title = view === "month" ? cursor.toLocaleDateString(locale, { month: "long", year: "numeric" }) : view === "day" ? cursor.toLocaleDateString(locale, { dateStyle: "full" }) : `${range.start.toLocaleDateString(locale, { day: "numeric", month: "short" })} — ${addDays(end, -1).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;
  const weekdays = Array.from({ length: 7 }, (_, i) => addDays(range.start, i).toLocaleDateString(locale, { weekday: "short" }));

  const Item = ({ p, compact }: { p: any; compact?: boolean }) => (
    <div draggable={!["published", "publishing", "partially_published"].includes(p.status)} onDragStart={() => setDrag(p.id)} onClick={(e) => { e.stopPropagation(); router.push(`/posts/${p.id}`); }}
      className={clsx("cursor-pointer rounded-md border-s-[3px] bg-muted/70 px-1.5 py-1 text-[11px] leading-4 transition hover:bg-primary/10", tone[p.status] ?? "border-s-border", drag === p.id && "opacity-40")} title={`${p.title} — ${STATUS_LABELS[p.status]?.[0] ?? p.status}`}>
      <div className="flex items-center gap-1"><span className="flex shrink-0">{[...new Set(p.variants.map((v: any) => v.platform))].slice(0, 3).map((pl: any) => <PlatformIcon key={pl} platform={pl} size={12} />)}</span><span className="tabular-nums text-subtle">{dateOf(p).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span></div>
      <div className={clsx("truncate font-medium", compact && "hidden sm:block")}>{p.title}</div>
    </div>);

  return <div>
    <PageHeader icon={<CalendarDays />} title={t("تقويم المحتوى", "Content calendar")} subtitle={t("اسحب المنشورات لتغيير مواعيدها", "Drag posts to reschedule")}
      actions={<Link href="/posts/new" className="btn-primary"><Plus className="h-4 w-4" />{t("منشور", "Post")}</Link>} />
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1"><button className="btn-outline h-9 w-9 p-0" onClick={() => shift(-1)}><ChevronRight className="h-4 w-4 ltr:rotate-180" /></button><button className="btn-outline h-9" onClick={() => setCursor(day0(new Date()))}>{t("اليوم", "Today")}</button><button className="btn-outline h-9 w-9 p-0" onClick={() => shift(1)}><ChevronLeft className="h-4 w-4 ltr:rotate-180" /></button></div>
      <h2 className="min-w-[160px] font-semibold">{title}</h2>{loading && <Spinner />}
      <div className="flex-1" />
      <select className="input w-auto" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">{t("كل المنصات", "All platforms")}</option>{["instagram", "x", "tiktok", "youtube", "snapchat", "gmail"].map((p) => <option key={p}>{p}</option>)}</select>
      <select className="input w-auto" value={campaign} onChange={(e) => setCampaign(e.target.value)}><option value="">{t("كل الحملات", "All campaigns")}</option>{campaigns?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className="input w-auto" value={statusF} onChange={(e) => setStatusF(e.target.value)}><option value="">{t("كل الحالات", "All statuses")}</option>{Object.entries(STATUS_LABELS).slice(0, 12).map(([k, v]) => <option key={k} value={k}>{t(v[0], v[1])}</option>)}</select>
      <Tabs value={view} onChange={setView} items={[{ value: "month", label: t("شهر", "Month") }, { value: "week", label: t("أسبوع", "Week") }, { value: "day", label: t("يوم", "Day") }, { value: "list", label: t("قائمة", "List") }]} />
    </div>
    {error ? <ErrorBox error={error} onRetry={reload} /> : null}
    {view === "list" ? <Card className="divide-y divide-border">{posts.length === 0 ? <p className="p-6 text-center text-sm text-subtle">{t("لا توجد منشورات في هذه الفترة", "No posts in this period")}</p> : posts.map((p) => <Link key={p.id} href={`/posts/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-muted/50"><span className="w-36 shrink-0 text-xs text-subtle">{dateOf(p).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</span><span className="flex">{p.variants.map((v: any) => <PlatformIcon key={v.id} platform={v.platform} size={18} />)}</span><span className="flex-1 truncate text-sm">{p.title}</span><StatusBadge status={p.status} /></Link>)}</Card> :
      <Card className="overflow-hidden">
        {view !== "day" && <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-medium text-subtle">{weekdays.map((w, i) => <div key={i} className="py-2">{w}</div>)}</div>}
        <div className={clsx("grid", view === "day" ? "grid-cols-1" : "grid-cols-7")}>
          {Array.from({ length: range.days }, (_, i) => addDays(range.start, i)).map((d) => {
            const items = forDay(d); const other = view === "month" && d.getMonth() !== cursor.getMonth(); const today = sameDay(d, new Date());
            return <div key={d.toISOString()} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(d)} onDoubleClick={() => router.push(`/posts/new?date=${d.toISOString()}`)}
              className={clsx("group relative border-b border-e border-border p-1.5 transition", view === "month" ? "min-h-[110px]" : "min-h-[420px]", other && "bg-muted/30 text-subtle", drag && "hover:bg-primary/5")}>
              <div className="mb-1 flex items-center justify-between"><span className={clsx("grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs", today && "bg-primary font-bold text-white")}>{d.getDate()}</span>
                <Link href={`/posts/new?date=${d.toISOString()}`} className="opacity-0 transition group-hover:opacity-100"><Plus className="h-3.5 w-3.5 text-subtle" /></Link></div>
              <div className="space-y-1">{(view === "month" ? items.slice(0, 3) : items).map((p) => <Item key={p.id} p={p} compact={view === "month"} />)}{view === "month" && items.length > 3 && <button className="text-[11px] text-primary" onClick={() => { setCursor(day0(d)); setView("day"); }}>+{items.length - 3}</button>}</div>
            </div>;
          })}
        </div>
      </Card>}
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-subtle">{[["scheduled", "border-s-primary"], ["published", "border-s-success"], ["in_review", "border-s-warning"], ["failed", "border-s-danger"]].map(([s, c]) => <span key={s} className={clsx("border-s-[3px] ps-1.5", c)}>{t(STATUS_LABELS[s][0], STATUS_LABELS[s][1])}</span>)}<span>· {t("انقر مرتين على يوم لإضافة منشور", "Double-click a day to add a post")}</span></div>
  </div>;
}
