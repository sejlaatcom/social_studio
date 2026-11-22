"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Save, Download, Type, Square, Circle, Minus, Image as ImageIcon, QrCode, Trash2, Copy, ArrowUp, ArrowDown, Undo2, Redo2, Layers, Maximize2, Eye, EyeOff, Lock, Unlock, ImagePlus, Palette, ArrowRight, Send } from "lucide-react";
import clsx from "clsx";
import { useT } from "@/components/i18n";
import { Card, Button, Field, Modal, Spinner, Toggle, useToast, ErrorBox } from "@/components/ui";
import { MediaPicker } from "@/components/media";
import { renderDesign, exportPng } from "@/components/design-render";
import { uid, type DesignDoc, type Layer } from "@/lib/design";
import { SIZE_PRESETS } from "@/lib/platforms";
import { api } from "@/lib/client";

const FONTS = ["Cairo", "Tajawal", "IBM Plex Sans Arabic", "Amiri", "Changa", "Inter", "Poppins"];
type Drag = { id: string; mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number };

export default function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT(); const toast = useToast();
  const [d, setD] = useState<any>(null); const [err, setErr] = useState<unknown>(null);
  const [doc, setDocRaw] = useState<DesignDoc | null>(null); const [sel, setSel] = useState<string | null>(null);
  const hist = useRef<{ past: DesignDoc[]; future: DesignDoc[] }>({ past: [], future: [] });
  const canvas = useRef<HTMLCanvasElement>(null); const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4); const [drag, setDrag] = useState<Drag | null>(null);
  const [pick, setPick] = useState<null | "image" | "bg" | "replace">(null); const [busy, setBusy] = useState(""); const [dirty, setDirty] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);

  useEffect(() => { api(`/api/designs/${id}`).then((x) => { setD(x); setDocRaw(x.document); }).catch(setErr); }, [id]);
  const setDoc = useCallback((nd: DesignDoc, record = true) => { setDocRaw((cur) => { if (record && cur) { hist.current.past.push(cur); hist.current.past = hist.current.past.slice(-60); hist.current.future = []; } return nd; }); setDirty(true); }, []);
  const undo = () => { const p = hist.current.past.pop(); if (p && doc) { hist.current.future.push(doc); setDocRaw(p); } };
  const redo = () => { const f = hist.current.future.pop(); if (f && doc) { hist.current.past.push(doc); setDocRaw(f); } };

  useEffect(() => {
    const fit = () => { if (!wrap.current || !d) return; const w = wrap.current.clientWidth - 32, h = Math.max(420, window.innerHeight - 260); setScale(Math.min(w / d.width, h / d.height, 1)); };
    fit(); window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit);
  }, [d]);
  useEffect(() => { if (doc && d && canvas.current) void renderDesign(canvas.current, doc, d.width, d.height, scale * (window.devicePixelRatio || 1)); }, [doc, d, scale]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); void save(); }
      if ((e.key === "Delete" || e.key === "Backspace") && sel) removeLayer(sel);
      if (sel && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); const s = e.shiftKey ? 10 : 1; const l = layer(sel)!; updL(sel, { x: l.x + (e.key === "ArrowLeft" ? -s : e.key === "ArrowRight" ? s : 0), y: l.y + (e.key === "ArrowUp" ? -s : e.key === "ArrowDown" ? s : 0) }); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  if (err) return <ErrorBox error={err} />;
  if (!d || !doc) return <div className="grid h-96 place-items-center"><Spinner className="h-6 w-6" /></div>;
  const layer = (lid: string) => doc.layers.find((l) => l.id === lid);
  const updL = (lid: string, patch: Partial<Layer>, record = true) => setDoc({ ...doc, layers: doc.layers.map((l) => (l.id === lid ? { ...l, ...patch } : l)) }, record);
  const addL = (l: Omit<Layer, "id">) => { const n = { ...l, id: uid() } as Layer; setDoc({ ...doc, layers: [...doc.layers, n] }); setSel(n.id); };
  const removeLayer = (lid: string) => { setDoc({ ...doc, layers: doc.layers.filter((l) => l.id !== lid) }); setSel(null); };
  const move = (lid: string, dir: 1 | -1) => { const i = doc.layers.findIndex((l) => l.id === lid); const j = i + dir; if (j < 0 || j >= doc.layers.length) return; const a = [...doc.layers]; [a[i], a[j]] = [a[j], a[i]]; setDoc({ ...doc, layers: a }); };
  const W = d.width, H = d.height, u = Math.min(W, H);
  const s = sel ? layer(sel) : null;

  async function save() { setBusy("save"); try { await api(`/api/designs/${id}`, { method: "PUT", body: { document: doc, name: d.name } }); setDirty(false); toast.success(t("تم حفظ التصميم", "Design saved")); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function exportToLibrary(format: "png" | "jpeg") {
    setBusy("export");
    try { await api(`/api/designs/${id}`, { method: "PUT", body: { document: doc } }); setDirty(false); const blob = await exportPng(doc!, W, H); const fd = new FormData(); fd.append("file", blob, "design.png"); fd.append("format", format); const a = await api(`/api/designs/${id}/export`, { form: fd }); toast.success(t("تم التصدير إلى مكتبة الملفات", "Exported to media library")); return a; }
    catch (e) { toast.error(e); } finally { setBusy(""); }
  }
  async function download() { const blob = await exportPng(doc!, W, H); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${d.name}.png`; a.click(); }
  async function useInPost() { const a = await exportToLibrary("png"); if (!a) return; sessionStorage.setItem("ss_draft", JSON.stringify({ title: d.name, media: [{ asset: a }], variants: [] })); window.location.href = "/posts/new?from=studio"; }

  function onDown(e: React.PointerEvent, l: Layer, mode: Drag["mode"]) {
    e.stopPropagation(); setSel(l.id); if (l.locked) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    hist.current.past.push(doc!); hist.current.future = [];
    setDrag({ id: l.id, mode, sx: e.clientX, sy: e.clientY, ox: l.x, oy: l.y, ow: l.w, oh: l.h });
  }
  function onMove(e: React.PointerEvent) {
    if (!drag) return; const dx = (e.clientX - drag.sx) / scale, dy = (e.clientY - drag.sy) / scale;
    if (drag.mode === "move") {
      let nx = Math.round(drag.ox + dx), ny = Math.round(drag.oy + dy); const l = layer(drag.id)!;
      const snap = 8 / scale; if (Math.abs(nx + l.w / 2 - W / 2) < snap) nx = Math.round(W / 2 - l.w / 2); if (Math.abs(ny + l.h / 2 - H / 2) < snap) ny = Math.round(H / 2 - l.h / 2);
      updL(drag.id, { x: nx, y: ny }, false);
    } else {
      const l = layer(drag.id)!; const keep = l.type === "image" || l.type === "qr" || (l.type === "shape" && l.shape === "circle" && e.shiftKey);
      let w = Math.max(20, Math.round(drag.ow + dx)), h = Math.max(20, Math.round(drag.oh + dy)); if (keep) h = Math.round(w * (drag.oh / drag.ow));
      updL(drag.id, { w, h }, false);
    }
  }

  return <div className="-mx-2">
    <div className="mb-3 flex flex-wrap items-center gap-2 px-2">
      <Link href="/design" className="btn-ghost h-9 w-9 p-0"><ArrowRight className="h-4 w-4 ltr:rotate-180" /></Link>
      <input className="input w-56 font-semibold" value={d.name} onChange={(e) => { setD({ ...d, name: e.target.value }); setDirty(true); }} />
      <span className="text-xs text-subtle" dir="ltr">{W}×{H}</span>
      <div className="mx-1 h-6 w-px bg-border" />
      <button className="btn-ghost h-9 w-9 p-0" onClick={undo} title="Undo"><Undo2 className="h-4 w-4" /></button><button className="btn-ghost h-9 w-9 p-0" onClick={redo} title="Redo"><Redo2 className="h-4 w-4" /></button>
      <div className="flex-1" />
      <Button variant="outline" onClick={() => setResizeOpen(true)}><Maximize2 className="h-4 w-4" />{t("مقاسات أخرى", "Resize")}</Button>
      <Button variant="outline" onClick={download}><Download className="h-4 w-4" />PNG</Button>
      <Button variant="outline" loading={busy === "export"} onClick={() => exportToLibrary("png")}><ImagePlus className="h-4 w-4" />{t("للمكتبة", "To library")}</Button>
      <Button variant="outline" onClick={useInPost}><Send className="h-4 w-4" />{t("استخدم في منشور", "Use in post")}</Button>
      <Button loading={busy === "save"} onClick={save}><Save className="h-4 w-4" />{t("حفظ", "Save")}{dirty && " •"}</Button>
    </div>
    <div className="grid gap-3 lg:grid-cols-[64px_1fr_300px]">
      <Card className="flex flex-row flex-wrap gap-1 p-2 lg:flex-col">
        {[
          [Type, t("نص", "Text"), () => addL({ type: "text", text: t("نص جديد", "New text"), x: W * 0.15, y: H * 0.4, w: W * 0.7, h: u * 0.15, fontFamily: "Cairo", fontSize: Math.round(u * 0.07), fontWeight: 700, color: "#111111", align: "center", lineHeight: 1.3 })],
          [Square, t("مستطيل", "Rect"), () => addL({ type: "shape", shape: "rect", x: W * 0.3, y: H * 0.3, w: u * 0.4, h: u * 0.25, fill: "#6d5dfc", radius: 24 })],
          [Circle, t("دائرة", "Circle"), () => addL({ type: "shape", shape: "circle", x: W * 0.35, y: H * 0.35, w: u * 0.3, h: u * 0.3, fill: "#f59e0b" })],
          [Minus, t("خط", "Line"), () => addL({ type: "shape", shape: "line", x: W * 0.2, y: H * 0.5, w: W * 0.6, h: 20, fill: "#111111", stroke: "#111111", strokeWidth: 6 })],
          [ImageIcon, t("صورة", "Image"), () => setPick("image")],
          [QrCode, "QR", () => addL({ type: "qr", qr: "https://example.com", x: W - u * 0.28, y: H - u * 0.28, w: u * 0.22, h: u * 0.22, qrColor: "#000000", qrBg: "#ffffff" })],
          [Palette, t("الخلفية", "Background"), () => setSel(null)],
        ].map(([Icon, label, fn]: any, i) => <button key={i} onClick={fn} className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-[10px] text-subtle hover:bg-muted hover:text-fg"><Icon className="h-5 w-5" />{label}</button>)}
      </Card>

      <div ref={wrap} className="grid min-h-[480px] place-items-center overflow-auto rounded-2xl bg-[repeating-conic-gradient(rgb(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] p-4" onPointerDown={() => setSel(null)}>
        <div className="relative shadow-pop" style={{ width: W * scale, height: H * scale }} onPointerMove={onMove} onPointerUp={() => setDrag(null)}>
          <canvas ref={canvas} style={{ width: W * scale, height: H * scale }} className="block" />
          {doc.layers.map((l) => !l.hidden && <div key={l.id} onPointerDown={(e) => onDown(e, l, "move")} onDoubleClick={() => l.type === "text" && document.getElementById("txt-edit")?.focus()}
            className={clsx("absolute touch-none", l.locked ? "cursor-default" : "cursor-move", sel === l.id ? "outline outline-2 outline-primary" : "hover:outline hover:outline-1 hover:outline-primary/60")}
            style={{ left: l.x * scale, top: l.y * scale, width: l.w * scale, height: l.h * scale, transform: `rotate(${l.rotation ?? 0}deg)` }}>
            {sel === l.id && !l.locked && <div onPointerDown={(e) => onDown(e, l, "resize")} className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-se-resize rounded-sm border-2 border-primary bg-white" />}
          </div>)}
        </div>
      </div>

      <Card className="max-h-[calc(100vh-180px)] space-y-4 overflow-y-auto p-4">
        {!s ? <BackgroundPanel doc={doc} setDoc={setDoc} onPickImage={() => setPick("bg")} /> : <LayerPanel l={s} upd={(p) => updL(s.id, p)} onReplace={() => setPick("replace")} />}
        {s && <div className="flex flex-wrap gap-1 border-t border-border pt-3">
          <button className="btn-ghost h-8 w-8 p-0" title="Up" onClick={() => move(s.id, 1)}><ArrowUp className="h-4 w-4" /></button>
          <button className="btn-ghost h-8 w-8 p-0" title="Down" onClick={() => move(s.id, -1)}><ArrowDown className="h-4 w-4" /></button>
          <button className="btn-ghost h-8 w-8 p-0" title="Duplicate" onClick={() => addL({ ...s, x: s.x + 20, y: s.y + 20 })}><Copy className="h-4 w-4" /></button>
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => updL(s.id, { locked: !s.locked })}>{s.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</button>
          <button className="btn-ghost h-8 px-2 text-xs" onClick={() => updL(s.id, { x: Math.round((W - s.w) / 2) })}>{t("توسيط أفقي", "Center H")}</button>
          <button className="btn-ghost h-8 px-2 text-xs" onClick={() => updL(s.id, { y: Math.round((H - s.h) / 2) })}>{t("توسيط عمودي", "Center V")}</button>
          <div className="flex-1" /><button className="btn-ghost h-8 w-8 p-0 text-danger" onClick={() => removeLayer(s.id)}><Trash2 className="h-4 w-4" /></button>
        </div>}
        <div className="border-t border-border pt-3"><div className="mb-2 flex items-center gap-1 text-xs font-semibold text-subtle"><Layers className="h-3.5 w-3.5" />{t("الطبقات", "Layers")}</div>
          <div className="space-y-0.5">{[...doc.layers].reverse().map((l) => <div key={l.id} className={clsx("flex items-center gap-2 rounded-lg px-2 py-1 text-xs", sel === l.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
            <button className="flex-1 truncate text-start" onClick={() => setSel(l.id)}>{l.type === "text" ? `T · ${l.text?.slice(0, 24)}` : l.type === "image" ? (l.role === "logo" ? t("الشعار", "Logo") : t("صورة", "Image")) : l.type === "qr" ? "QR" : l.shape}</button>
            <button onClick={() => updL(l.id, { hidden: !l.hidden })}>{l.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></div>)}</div></div>
      </Card>
    </div>
    <MediaPicker open={!!pick} kind="image" onClose={() => setPick(null)} onPick={(as) => {
      const a = as[0]; if (!a) return;
      if (pick === "bg") setDoc({ ...doc, background: { ...doc.background, type: "image", assetId: a.id, overlay: doc.background.overlay ?? 0.2 } });
      else if (pick === "replace" && s) updL(s.id, { assetId: a.id });
      else { const r = (a.width && a.height) ? a.height / a.width : 1; const w = Math.round(u * 0.5); addL({ type: "image", assetId: a.id, x: Math.round((W - w) / 2), y: Math.round((H - w * r) / 2), w, h: Math.round(w * r), fit: "cover", radius: 0 }); }
    }} />
    <ResizeModal open={resizeOpen} onClose={() => setResizeOpen(false)} id={id} current={d.preset} />
  </div>;
}

function BackgroundPanel({ doc, setDoc, onPickImage }: { doc: DesignDoc; setDoc: (d: DesignDoc) => void; onPickImage: () => void }) {
  const t = useT(); const b = doc.background; const set = (p: Partial<DesignDoc["background"]>) => setDoc({ ...doc, background: { ...b, ...p } });
  return <div className="space-y-3"><h3 className="text-sm font-semibold">{t("الخلفية", "Background")}</h3>
    <div className="grid grid-cols-3 gap-1">{(["color", "gradient", "image"] as const).map((k) => <button key={k} onClick={() => (k === "image" ? onPickImage() : set({ type: k }))} className={clsx("rounded-lg border py-1.5 text-xs", b.type === k ? "border-primary bg-primary/10" : "border-border")}>{{ color: t("لون", "Color"), gradient: t("تدرج", "Gradient"), image: t("صورة", "Image") }[k]}</button>)}</div>
    <div className="flex gap-2"><Field label={t("اللون 1", "Color 1")}><input type="color" className="h-9 w-full cursor-pointer rounded-lg" value={b.color} onChange={(e) => set({ color: e.target.value })} /></Field>
      {b.type === "gradient" && <Field label={t("اللون 2", "Color 2")}><input type="color" className="h-9 w-full cursor-pointer rounded-lg" value={b.color2 ?? b.color} onChange={(e) => set({ color2: e.target.value })} /></Field>}</div>
    {b.type === "gradient" && <Field label={t("الزاوية", "Angle")}><input type="range" min={0} max={360} value={b.angle ?? 135} onChange={(e) => set({ angle: Number(e.target.value) })} className="w-full" /></Field>}
    {b.type === "image" && <><Field label={t("تعتيم الصورة", "Image overlay")}><input type="range" min={0} max={0.9} step={0.05} value={b.overlay ?? 0} onChange={(e) => set({ overlay: Number(e.target.value) })} className="w-full" /></Field><Button variant="outline" className="w-full" onClick={onPickImage}>{t("تغيير الصورة", "Change image")}</Button></>}
  </div>;
}

function LayerPanel({ l, upd, onReplace }: { l: Layer; upd: (p: Partial<Layer>) => void; onReplace: () => void }) {
  const t = useT(); const num = (k: keyof Layer) => ({ value: Math.round((l[k] as number) ?? 0), onChange: (e: React.ChangeEvent<HTMLInputElement>) => upd({ [k]: Number(e.target.value) } as Partial<Layer>) });
  return <div className="space-y-3">
    {l.type === "text" && <>
      <Field label={t("النص", "Text")}><textarea id="txt-edit" className="input min-h-[80px]" value={l.text} onChange={(e) => upd({ text: e.target.value })} /></Field>
      <Field label={t("الخط", "Font")}><select className="input" value={l.fontFamily} onChange={(e) => upd({ fontFamily: e.target.value })} style={{ fontFamily: l.fontFamily }}>{FONTS.map((f) => <option key={f} style={{ fontFamily: f }}>{f}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-2"><Field label={t("الحجم", "Size")}><input type="number" className="input" {...num("fontSize")} /></Field>
        <Field label={t("السماكة", "Weight")}><select className="input" value={l.fontWeight} onChange={(e) => upd({ fontWeight: Number(e.target.value) })}>{[400, 500, 700, 800, 900].map((w) => <option key={w}>{w}</option>)}</select></Field></div>
      <div className="grid grid-cols-3 gap-1">{(["right", "center", "left"] as const).map((a) => <button key={a} onClick={() => upd({ align: a })} className={clsx("rounded-lg border py-1 text-xs", l.align === a ? "border-primary bg-primary/10" : "border-border")}>{{ right: t("يمين", "Right"), center: t("وسط", "Center"), left: t("يسار", "Left") }[a]}</button>)}</div>
      <div className="grid grid-cols-2 gap-2"><Field label={t("لون النص", "Text color")}><input type="color" className="h-9 w-full rounded-lg" value={l.color} onChange={(e) => upd({ color: e.target.value })} /></Field>
        <Field label={t("خلفية النص", "Text bg")}><div className="flex gap-1"><input type="color" className="h-9 w-full rounded-lg" value={l.bg ?? "#ffffff"} onChange={(e) => upd({ bg: e.target.value })} />{l.bg && <button className="text-xs text-danger" onClick={() => upd({ bg: null })}>×</button>}</div></Field></div>
      <Field label={t("تباعد الأسطر", "Line height")}><input type="range" min={0.9} max={2.2} step={0.05} value={l.lineHeight ?? 1.3} onChange={(e) => upd({ lineHeight: Number(e.target.value) })} className="w-full" /></Field>
    </>}
    {l.type === "shape" && <div className="grid grid-cols-2 gap-2"><Field label={t("التعبئة", "Fill")}><input type="color" className="h-9 w-full rounded-lg" value={l.fill} onChange={(e) => upd({ fill: e.target.value, ...(l.shape === "line" ? { stroke: e.target.value } : {}) })} /></Field>
      {l.shape === "rect" && <Field label={t("الزوايا", "Radius")}><input type="number" className="input" {...num("radius")} /></Field>}
      {l.shape === "line" && <Field label={t("السماكة", "Width")}><input type="number" className="input" {...num("strokeWidth")} /></Field>}</div>}
    {l.type === "image" && <><div className="grid grid-cols-2 gap-1">{(["cover", "contain"] as const).map((f) => <button key={f} onClick={() => upd({ fit: f })} className={clsx("rounded-lg border py-1 text-xs", l.fit === f ? "border-primary bg-primary/10" : "border-border")}>{f === "cover" ? t("ملء وقص", "Cover / crop") : t("احتواء", "Contain")}</button>)}</div>
      <Field label={t("الزوايا", "Radius")}><input type="number" className="input" {...num("radius")} /></Field><Button variant="outline" className="w-full" onClick={onReplace}>{t("استبدال الصورة", "Replace image")}</Button></>}
    {l.type === "qr" && <><Field label={t("الرابط أو النص", "URL or text")}><input className="input" dir="ltr" value={l.qr} onChange={(e) => upd({ qr: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label={t("اللون", "Color")}><input type="color" className="h-9 w-full rounded-lg" value={l.qrColor} onChange={(e) => upd({ qrColor: e.target.value })} /></Field><Field label={t("الخلفية", "Bg")}><input type="color" className="h-9 w-full rounded-lg" value={l.qrBg} onChange={(e) => upd({ qrBg: e.target.value })} /></Field></div></>}
    <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
      <Field label="X"><input type="number" className="input" {...num("x")} /></Field><Field label="Y"><input type="number" className="input" {...num("y")} /></Field>
      <Field label={t("العرض", "W")}><input type="number" className="input" {...num("w")} /></Field><Field label={t("الارتفاع", "H")}><input type="number" className="input" {...num("h")} /></Field>
      <Field label={t("الدوران", "Rotate")}><input type="number" className="input" {...num("rotation")} /></Field>
      <Field label={t("الشفافية", "Opacity")}><input type="range" min={0.05} max={1} step={0.05} value={l.opacity ?? 1} onChange={(e) => upd({ opacity: Number(e.target.value) })} className="mt-2 w-full" /></Field>
    </div>
    <div className="space-y-2"><Toggle checked={!!l.shadow} onChange={(v) => upd({ shadow: v })} label={t("ظل", "Shadow")} />
      <Toggle checked={!!l.frame} onChange={(v) => upd({ frame: v ? { color: "#ffffff", width: 6 } : null })} label={t("إطار", "Frame")} />
      {l.frame && <div className="flex gap-2"><input type="color" className="h-8 w-14 rounded" value={l.frame.color} onChange={(e) => upd({ frame: { ...l.frame!, color: e.target.value } })} /><input type="number" className="input h-8" value={l.frame.width} onChange={(e) => upd({ frame: { ...l.frame!, width: Number(e.target.value) } })} /></div>}</div>
  </div>;
}

function ResizeModal({ open, onClose, id, current }: { open: boolean; onClose: () => void; id: string; current: string }) {
  const t = useT(); const toast = useToast(); const [sel, setSel] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [done, setDone] = useState<any[] | null>(null);
  async function go() { setBusy(true); try { setDone(await api(`/api/designs/${id}/resize`, { body: { presets: sel } })); toast.success(t("تم إنشاء النسخ", "Copies created")); } catch (e) { toast.error(e); } finally { setBusy(false); } }
  return <Modal open={open} onClose={() => { setDone(null); onClose(); }} title={t("تحويل التصميم إلى مقاسات متعددة", "Resize to multiple formats")} footer={!done && <Button onClick={go} loading={busy} disabled={!sel.length}>{t("إنشاء", "Create")} ({sel.length})</Button>}>
    {done ? <div className="space-y-2">{done.map((x) => <Link key={x.id} href={`/design/${x.id}`} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm hover:bg-muted">{x.name}<span className="text-xs text-subtle" dir="ltr">{x.width}×{x.height}</span></Link>)}</div> :
      <div className="grid gap-2 sm:grid-cols-2">{Object.entries(SIZE_PRESETS).filter(([k]) => k !== current).map(([k, p]) => <label key={k} className={clsx("flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-sm", sel.includes(k) ? "border-primary bg-primary/5" : "border-border")}>
        <input type="checkbox" checked={sel.includes(k)} onChange={() => setSel(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k])} /><span className="flex-1">{t(p.nameAr, p.name)}</span><span className="text-xs text-subtle" dir="ltr">{p.width}×{p.height}</span></label>)}</div>}
  </Modal>;
}
