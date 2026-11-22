// Shared (server + client) design document model, layout generator and smart resize.
export type Layer = {
  id: string; type: "text" | "image" | "shape" | "qr"; name?: string;
  x: number; y: number; w: number; h: number; rotation?: number; opacity?: number; locked?: boolean; hidden?: boolean;
  text?: string; fontFamily?: string; fontSize?: number; fontWeight?: number; color?: string; align?: "left" | "center" | "right"; lineHeight?: number; letterSpacing?: number; bg?: string | null; padding?: number;
  assetId?: string; fit?: "cover" | "contain"; radius?: number;
  shape?: "rect" | "circle" | "line"; fill?: string; stroke?: string | null; strokeWidth?: number;
  qr?: string; qrColor?: string; qrBg?: string;
  shadow?: boolean; frame?: { color: string; width: number } | null;
  role?: "background" | "headline" | "subheadline" | "cta" | "badge" | "logo" | "decor" | "body";
};
export type Background = { type: "color" | "gradient" | "image"; color: string; color2?: string; angle?: number; assetId?: string | null; overlay?: number };
export type DesignDoc = { background: Background; layers: Layer[] };

export const uid = () => Math.random().toString(36).slice(2, 10);

export type Copy = { headline: string; subheadline: string; cta: string; badge: string };
export type Palette = { background: string; backgroundAlt: string; primary: string; text: string; accent: string };

export function buildLayout(o: { W: number; H: number; copy: Copy; palette: Palette; layout: string; bgAssetId?: string | null; logoAssetId?: string | null; headingFont?: string; bodyFont?: string }): DesignDoc {
  const { W, H, copy, palette: p } = o; const m = Math.round(Math.min(W, H) * 0.07); const hf = o.headingFont ?? "Cairo"; const bf = o.bodyFont ?? "IBM Plex Sans Arabic";
  const unit = Math.min(W, H); const tall = H / W > 1.3; const wide = W / H > 1.3;
  const layers: Layer[] = [];
  const bg: Background = o.bgAssetId ? { type: "image", color: p.background, assetId: o.bgAssetId, overlay: o.layout === "minimal" ? 0.25 : 0.45 } : { type: "gradient", color: p.background, color2: p.backgroundAlt, angle: 135 };
  const textColor = o.bgAssetId ? "#ffffff" : p.text;
  if (o.layout === "split" && !tall) {
    layers.push({ id: uid(), type: "shape", role: "decor", shape: "rect", x: 0, y: 0, w: Math.round(W * 0.55), h: H, fill: p.background, opacity: o.bgAssetId ? 0.88 : 1, name: "panel" });
    const cw = Math.round(W * 0.55) - m * 2;
    layers.push({ id: uid(), type: "text", role: "headline", text: copy.headline, x: m, y: Math.round(H * 0.22), w: cw, h: Math.round(H * 0.3), fontFamily: hf, fontSize: Math.round(unit * (wide ? 0.11 : 0.085)), fontWeight: 800, color: p.text, align: "right", lineHeight: 1.25 });
    layers.push({ id: uid(), type: "text", role: "subheadline", text: copy.subheadline, x: m, y: Math.round(H * 0.55), w: cw, h: Math.round(H * 0.16), fontFamily: bf, fontSize: Math.round(unit * (wide ? 0.05 : 0.04)), fontWeight: 400, color: p.text, align: "right", lineHeight: 1.5, opacity: 0.85 });
    if (copy.cta) layers.push({ id: uid(), type: "text", role: "cta", text: copy.cta, x: m, y: Math.round(H * 0.76), w: Math.round(cw * 0.6), h: Math.round(unit * 0.11), fontFamily: hf, fontSize: Math.round(unit * 0.045), fontWeight: 700, color: "#ffffff", bg: p.primary, align: "center", radius: Math.round(unit * 0.03), padding: Math.round(unit * 0.02), shadow: true });
  } else {
    const bold = o.layout === "bold";
    if (!o.bgAssetId && o.layout !== "minimal") {
      layers.push({ id: uid(), type: "shape", role: "decor", shape: "circle", x: Math.round(W * 0.62), y: Math.round(-H * 0.12), w: Math.round(unit * 0.7), h: Math.round(unit * 0.7), fill: p.accent, opacity: 0.18 });
      layers.push({ id: uid(), type: "shape", role: "decor", shape: "circle", x: Math.round(-W * 0.18), y: Math.round(H * 0.7), w: Math.round(unit * 0.55), h: Math.round(unit * 0.55), fill: p.primary, opacity: 0.16 });
    }
    const top = tall ? H * 0.3 : H * 0.24;
    layers.push({ id: uid(), type: "text", role: "headline", text: copy.headline, x: m, y: Math.round(top), w: W - m * 2, h: Math.round(H * (tall ? 0.22 : 0.3)), fontFamily: hf, fontSize: Math.round(unit * (bold ? 0.13 : 0.1)), fontWeight: 900, color: textColor, align: "center", lineHeight: 1.2, shadow: !!o.bgAssetId });
    layers.push({ id: uid(), type: "text", role: "subheadline", text: copy.subheadline, x: Math.round(m * 1.5), y: Math.round(top + H * (tall ? 0.24 : 0.32)), w: W - m * 3, h: Math.round(H * 0.14), fontFamily: bf, fontSize: Math.round(unit * 0.045), fontWeight: 500, color: textColor, align: "center", lineHeight: 1.5, opacity: 0.92, shadow: !!o.bgAssetId });
    if (copy.cta) { const cw = Math.round(unit * 0.5); layers.push({ id: uid(), type: "text", role: "cta", text: copy.cta, x: Math.round((W - cw) / 2), y: Math.round(H * (tall ? 0.72 : 0.78)), w: cw, h: Math.round(unit * 0.11), fontFamily: hf, fontSize: Math.round(unit * 0.05), fontWeight: 700, color: "#ffffff", bg: p.primary, align: "center", radius: Math.round(unit * 0.055), padding: Math.round(unit * 0.02), shadow: true }); }
  }
  if (copy.badge) { const s = Math.round(unit * 0.2); layers.push({ id: uid(), type: "text", role: "badge", text: copy.badge, x: W - m - s, y: m, w: s, h: s, fontFamily: hf, fontSize: Math.round(unit * 0.045), fontWeight: 900, color: "#ffffff", bg: p.accent, align: "center", radius: s / 2, rotation: -8, shadow: true }); }
  if (o.logoAssetId) { const s = Math.round(unit * 0.13); layers.push({ id: uid(), type: "image", role: "logo", assetId: o.logoAssetId, x: m, y: m, w: s, h: s, fit: "contain" }); }
  return { background: bg, layers };
}

/** Re-flows a design to a new canvas keeping relative positions & visual hierarchy. */
export function smartResize(doc: DesignDoc, W1: number, H1: number, W2: number, H2: number): DesignDoc {
  const sx = W2 / W1, sy = H2 / H1, s = Math.min(sx, sy);
  const layers = doc.layers.map((l) => {
    const n: Layer = { ...l, id: uid() };
    const fullW = l.w >= W1 * 0.9, fullH = l.h >= H1 * 0.9;
    if (l.type === "shape" && (fullW || fullH)) { n.x = Math.round(l.x * sx); n.y = Math.round(l.y * sy); n.w = Math.round(l.w * sx); n.h = Math.round(l.h * sy); return n; }
    const cx = (l.x + l.w / 2) / W1, cy = (l.y + l.h / 2) / H1;
    if (l.type === "text") {
      n.fontSize = Math.max(10, Math.round((l.fontSize ?? 40) * s * (sx > sy ? 1 : 1)));
      n.w = Math.round(Math.min(W2 * 0.92, l.w * sx)); n.h = Math.round(l.h * s * (sy / s > 1.2 ? 1.25 : 1));
      if (l.radius) n.radius = Math.round(l.radius * s); if (l.padding) n.padding = Math.round(l.padding * s);
    } else { n.w = Math.round(l.w * s); n.h = Math.round(l.h * s); if (l.radius) n.radius = Math.round(l.radius * s); }
    n.x = Math.round(cx * W2 - n.w / 2); n.y = Math.round(cy * H2 - n.h / 2);
    n.x = Math.max(-n.w / 2, Math.min(W2 - n.w / 2, n.x));
    return n;
  });
  return { background: { ...doc.background }, layers };
}

export const TEMPLATES: { id: string; ar: string; en: string; layout: string; copy: Copy; palette: Palette }[] = [
  { id: "sale", ar: "عرض وخصم", en: "Sale", layout: "bold", copy: { headline: "خصم 20% على كل المنتجات", subheadline: "لفترة محدودة — تسوّق الآن قبل نفاد الكمية", cta: "تسوّق الآن", badge: "20%" }, palette: { background: "#1e1b4b", backgroundAlt: "#6d28d9", primary: "#f59e0b", text: "#ffffff", accent: "#ef4444" } },
  { id: "quote", ar: "اقتباس", en: "Quote", layout: "minimal", copy: { headline: "“النجاح رحلة وليس محطة”", subheadline: "— اسم القائل", cta: "", badge: "" }, palette: { background: "#fafaf9", backgroundAlt: "#e7e5e4", primary: "#0f766e", text: "#1c1917", accent: "#0f766e" } },
  { id: "announce", ar: "إعلان / إطلاق", en: "Announcement", layout: "centered", copy: { headline: "إطلاق جديد", subheadline: "اكتشف أحدث منتجاتنا المصممة خصيصًا لك", cta: "اكتشف المزيد", badge: "جديد" }, palette: { background: "#0f172a", backgroundAlt: "#1d4ed8", primary: "#22d3ee", text: "#ffffff", accent: "#f43f5e" } },
  { id: "tip", ar: "محتوى تعليمي", en: "Educational tip", layout: "split", copy: { headline: "3 نصائح ذهبية", subheadline: "خطوات بسيطة تصنع فرقًا كبيرًا في نتائجك", cta: "احفظ المنشور", badge: "" }, palette: { background: "#ecfdf5", backgroundAlt: "#a7f3d0", primary: "#047857", text: "#064e3b", accent: "#f59e0b" } },
  { id: "event", ar: "مناسبة / تهنئة", en: "Occasion", layout: "centered", copy: { headline: "عيد مبارك", subheadline: "كل عام وأنتم بخير", cta: "", badge: "" }, palette: { background: "#422006", backgroundAlt: "#a16207", primary: "#fde68a", text: "#fffbeb", accent: "#fbbf24" } },
  { id: "product", ar: "صورة منتج", en: "Product", layout: "split", copy: { headline: "اسم المنتج", subheadline: "وصف قصير لأهم ميزة في المنتج", cta: "اطلب الآن", badge: "99 ر.س" }, palette: { background: "#ffffff", backgroundAlt: "#f1f5f9", primary: "#111827", text: "#111827", accent: "#dc2626" } },
];
