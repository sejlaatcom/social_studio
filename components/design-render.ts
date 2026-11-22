"use client";
import QRCode from "qrcode";
import type { DesignDoc, Layer } from "@/lib/design";

const imgCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string) {
  if (!imgCache.has(src)) imgCache.set(src, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }));
  return imgCache.get(src)!;
}
const assetSrc = (id: string) => `/api/media/${id}/file`;
const isRtl = (s: string) => /[֐-ࣿיִ-﻿]/.test(s);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/); let line = "";
    for (const w of words) { const test = line ? `${line} ${w}` : w; if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }
    out.push(line);
  }
  return out;
}
function drawImageFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, fit: "cover" | "contain") {
  const r = Math.max(w / img.width, h / img.height), c = Math.min(w / img.width, h / img.height); const s = fit === "cover" ? r : c;
  const dw = img.width * s, dh = img.height * s; ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export async function preloadFonts(doc: DesignDoc) {
  const fams = new Set(doc.layers.filter((l) => l.type === "text").map((l) => `${l.fontWeight ?? 400} 32px "${l.fontFamily ?? "Cairo"}"`));
  await Promise.all([...fams].map((f) => document.fonts.load(f, "أبجد abc").catch(() => null)));
}

export async function renderDesign(canvas: HTMLCanvasElement, doc: DesignDoc, W: number, H: number, scale = 1) {
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d")!; ctx.setTransform(scale, 0, 0, scale, 0, 0);
  await preloadFonts(doc);
  const bg = doc.background;
  if (bg.type === "gradient") {
    const a = ((bg.angle ?? 135) * Math.PI) / 180; const cx = W / 2, cy = H / 2, r = Math.hypot(W, H) / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.addColorStop(0, bg.color); g.addColorStop(1, bg.color2 ?? bg.color); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else { ctx.fillStyle = bg.color; ctx.fillRect(0, 0, W, H); }
  if (bg.type === "image" && bg.assetId) {
    try { drawImageFit(ctx, await loadImage(assetSrc(bg.assetId)), 0, 0, W, H, "cover"); } catch { /* missing */ }
    if (bg.overlay) { ctx.fillStyle = `rgba(0,0,0,${bg.overlay})`; ctx.fillRect(0, 0, W, H); }
  }
  for (const l of doc.layers) { if (!l.hidden) await drawLayer(ctx, l); }
}

async function drawLayer(ctx: CanvasRenderingContext2D, l: Layer) {
  ctx.save();
  ctx.globalAlpha = l.opacity ?? 1;
  ctx.translate(l.x + l.w / 2, l.y + l.h / 2); ctx.rotate(((l.rotation ?? 0) * Math.PI) / 180); ctx.translate(-l.w / 2, -l.h / 2);
  if (l.shadow) { ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = Math.max(6, l.h * 0.08); ctx.shadowOffsetY = Math.max(2, l.h * 0.03); }
  if (l.type === "shape") {
    ctx.fillStyle = l.fill ?? "#000";
    if (l.shape === "circle") { ctx.beginPath(); ctx.ellipse(l.w / 2, l.h / 2, l.w / 2, l.h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (l.shape === "line") { ctx.strokeStyle = l.stroke ?? l.fill ?? "#000"; ctx.lineWidth = l.strokeWidth ?? 4; ctx.beginPath(); ctx.moveTo(0, l.h / 2); ctx.lineTo(l.w, l.h / 2); ctx.stroke(); }
    else { roundRect(ctx, 0, 0, l.w, l.h, l.radius ?? 0); ctx.fill(); }
    if (l.stroke && l.shape !== "line") { ctx.shadowColor = "transparent"; ctx.strokeStyle = l.stroke; ctx.lineWidth = l.strokeWidth ?? 2; ctx.stroke(); }
  } else if (l.type === "image" && l.assetId) {
    try {
      const img = await loadImage(assetSrc(l.assetId));
      roundRect(ctx, 0, 0, l.w, l.h, l.radius ?? 0); ctx.save(); ctx.clip(); drawImageFit(ctx, img, 0, 0, l.w, l.h, l.fit ?? "cover"); ctx.restore();
    } catch { ctx.fillStyle = "#ddd"; ctx.fillRect(0, 0, l.w, l.h); }
  } else if (l.type === "qr" && l.qr) {
    const url = await QRCode.toDataURL(l.qr, { margin: 1, width: Math.round(l.w * 2), color: { dark: l.qrColor ?? "#000000", light: l.qrBg ?? "#ffffff" } });
    ctx.drawImage(await loadImage(url), 0, 0, l.w, l.h);
  } else if (l.type === "text") {
    const pad = l.padding ?? 0; const fs = l.fontSize ?? 40; const lh = fs * (l.lineHeight ?? 1.3);
    ctx.font = `${l.fontWeight ?? 400} ${fs}px "${l.fontFamily ?? "Cairo"}", "IBM Plex Sans Arabic", sans-serif`;
    if ("letterSpacing" in ctx && l.letterSpacing) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${l.letterSpacing}px`;
    const lines = wrap(ctx, l.text ?? "", l.w - pad * 2);
    if (l.bg) { ctx.fillStyle = l.bg; roundRect(ctx, 0, 0, l.w, l.h, l.radius ?? 0); ctx.fill(); ctx.shadowColor = "transparent"; }
    if (l.frame) { ctx.strokeStyle = l.frame.color; ctx.lineWidth = l.frame.width; roundRect(ctx, 0, 0, l.w, l.h, l.radius ?? 0); ctx.stroke(); }
    ctx.fillStyle = l.color ?? "#000"; ctx.textBaseline = "middle";
    const rtl = isRtl(l.text ?? ""); ctx.direction = rtl ? "rtl" : "ltr";
    const align = l.align ?? "center"; ctx.textAlign = align;
    const tx = align === "center" ? l.w / 2 : align === "right" ? l.w - pad : pad;
    const total = lines.length * lh; let y = (l.h - total) / 2 + lh / 2;
    for (const line of lines) { ctx.fillText(line, tx, y); y += lh; }
  }
  if (l.frame && l.type !== "text") { ctx.shadowColor = "transparent"; ctx.strokeStyle = l.frame.color; ctx.lineWidth = l.frame.width; roundRect(ctx, 0, 0, l.w, l.h, l.radius ?? 0); ctx.stroke(); }
  ctx.restore();
}

export async function exportPng(doc: DesignDoc, W: number, H: number): Promise<Blob> {
  const c = document.createElement("canvas"); await renderDesign(c, doc, W, H, 1);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), "image/png"));
}
