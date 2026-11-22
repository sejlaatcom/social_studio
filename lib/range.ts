export function parseRange(sp: URLSearchParams) {
  const r = sp.get("range") ?? "month"; const now = new Date();
  const start = (d: number) => new Date(now.getTime() - d * 86400000);
  if (r === "custom" && sp.get("from") && sp.get("to")) return { from: new Date(sp.get("from")!), to: new Date(new Date(sp.get("to")!).getTime() + 86399999), range: r };
  if (r === "today") { const d = new Date(now); d.setHours(0, 0, 0, 0); return { from: d, to: now, range: r }; }
  if (r === "week") return { from: start(7), to: now, range: r };
  if (r === "90d") return { from: start(90), to: now, range: r };
  if (r === "year") return { from: start(365), to: now, range: r };
  return { from: start(30), to: now, range: "month" };
}
