"use client";
import { useT } from "./i18n";
import { Tabs } from "./ui";

export type RangeValue = { range: string; from?: string; to?: string };
export function rangeQuery(r: RangeValue) { return `range=${r.range}${r.range === "custom" && r.from && r.to ? `&from=${r.from}&to=${r.to}` : ""}`; }

export function RangePicker({ value, onChange }: { value: RangeValue; onChange: (v: RangeValue) => void }) {
  const t = useT();
  return <div className="flex flex-wrap items-center gap-2">
    <Tabs value={value.range} onChange={(range) => onChange({ ...value, range })} items={[
      { value: "today", label: t("اليوم", "Today") }, { value: "week", label: t("الأسبوع", "Week") }, { value: "month", label: t("الشهر", "Month") },
      { value: "90d", label: t("90 يومًا", "90 days") }, { value: "custom", label: t("مخصص", "Custom") },
    ]} />
    {value.range === "custom" && <div className="flex items-center gap-1">
      <input type="date" className="input w-auto py-1.5" value={value.from ?? ""} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      <span className="text-subtle">—</span>
      <input type="date" className="input w-auto py-1.5" value={value.to ?? ""} onChange={(e) => onChange({ ...value, to: e.target.value })} />
    </div>}
  </div>;
}
