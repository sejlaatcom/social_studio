"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useState } from "react";

// Categorical slots (validated reference palette), light/dark stepped.
const LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"];
export function useSeries() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement; const f = () => setDark(el.classList.contains("dark")); f();
    const o = new MutationObserver(f); o.observe(el, { attributes: true, attributeFilter: ["class"] }); return () => o.disconnect();
  }, []);
  return dark ? DARK : LIGHT;
}
const axis = { stroke: "rgb(var(--subtle))", fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = { contentStyle: { background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 10, fontSize: 12, color: "rgb(var(--fg))" }, labelStyle: { color: "rgb(var(--subtle))" } };
const fmt = (n: number) => Intl.NumberFormat("en", { notation: "compact" }).format(n);

export function TrendChart({ data, x, y, label, height = 240 }: { data: Record<string, unknown>[]; x: string; y: string; label: string; height?: number }) {
  const c = useSeries()[0];
  return <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
      <defs><linearGradient id={`g-${y}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity={0.25} /><stop offset="100%" stopColor={c} stopOpacity={0} /></linearGradient></defs>
      <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeDasharray="3 3" />
      <XAxis dataKey={x} {...axis} minTickGap={24} reversed={typeof document !== "undefined" && document.dir === "rtl"} />
      <YAxis {...axis} width={40} tickFormatter={fmt} orientation={typeof document !== "undefined" && document.dir === "rtl" ? "right" : "left"} />
      <Tooltip {...tip} cursor={{ stroke: "rgb(var(--subtle))", strokeDasharray: "3 3" }} formatter={(v) => [Number(v).toLocaleString(), label]} />
      <Area type="monotone" dataKey={y} name={label} stroke={c} strokeWidth={2} fill={`url(#g-${y})`} activeDot={{ r: 5, strokeWidth: 2, stroke: "rgb(var(--surface))" }} />
    </AreaChart>
  </ResponsiveContainer>;
}

export function BarsChart({ data, x, y, label, height = 240 }: { data: Record<string, unknown>[]; x: string; y: string; label: string; height?: number }) {
  const c = useSeries()[0];
  return <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="30%">
      <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeDasharray="3 3" />
      <XAxis dataKey={x} {...axis} reversed={typeof document !== "undefined" && document.dir === "rtl"} />
      <YAxis {...axis} width={40} tickFormatter={fmt} orientation={typeof document !== "undefined" && document.dir === "rtl" ? "right" : "left"} />
      <Tooltip {...tip} cursor={{ fill: "rgb(var(--muted))" }} formatter={(v) => [Number(v).toLocaleString(), label]} />
      <Bar dataKey={y} name={label} fill={c} radius={[4, 4, 0, 0]} maxBarSize={44} />
    </BarChart>
  </ResponsiveContainer>;
}

export function MultiLine({ data, x, series, height = 260 }: { data: Record<string, unknown>[]; x: string; series: { key: string; label: string }[]; height?: number }) {
  const colors = useSeries();
  return <ResponsiveContainer width="100%" height={height}>
    <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
      <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeDasharray="3 3" />
      <XAxis dataKey={x} {...axis} minTickGap={24} reversed={typeof document !== "undefined" && document.dir === "rtl"} />
      <YAxis {...axis} width={44} tickFormatter={fmt} orientation={typeof document !== "undefined" && document.dir === "rtl" ? "right" : "left"} />
      <Tooltip {...tip} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      {series.slice(0, 8).map((s, i) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={colors[i]} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 5 }} />)}
    </LineChart>
  </ResponsiveContainer>;
}
