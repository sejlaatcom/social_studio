"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clapperboard, Save, Wand2, Mic, Film, Download, Plus, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, Music, Play, Pause, Captions, ArrowRight, Send, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { useT } from "@/components/i18n";
import { Card, Button, Field, Badge, Spinner, ErrorBox, useToast, Modal } from "@/components/ui";
import { MediaPicker, fileUrl, type Asset } from "@/components/media";
import { StatusBadge } from "@/components/status";
import { api } from "@/lib/client";

type Scene = { id?: string; durationSec: number; narration: string; onScreenText: string; visualPrompt: string; assetId: string | null; voiceAssetId: string | null; transition: string };

export default function VideoEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT(); const toast = useToast();
  const [v, setV] = useState<any>(null); const [err, setErr] = useState<unknown>(null);
  const [scenes, setScenes] = useState<Scene[]>([]); const [assets, setAssets] = useState<Record<string, Asset>>({});
  const [sel, setSel] = useState(0); const [busy, setBusy] = useState(""); const [dirty, setDirty] = useState(false);
  const [pick, setPick] = useState<null | "scene" | "music">(null); const [playing, setPlaying] = useState(false); const [scriptOpen, setScriptOpen] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() { try { const x = await api(`/api/videos/${id}`); setV(x); setScenes(x.scenes); setAssets(x.assets); setDirty(false); } catch (e) { setErr(e); } }
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (v?.status !== "rendering") return; const i = setInterval(async () => { const x = await api(`/api/videos/${id}`); if (x.status !== "rendering") { setV(x); setAssets(x.assets); toast[x.status === "rendered" ? "success" : "error"](x.status === "rendered" ? t("اكتمل إخراج الفيديو", "Video rendered") : x.renderError ?? "failed"); } }, 4000); return () => clearInterval(i); }, [v?.status, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <ErrorBox error={err} />;
  if (!v) return <div className="grid h-96 place-items-center"><Spinner className="h-6 w-6" /></div>;
  const total = scenes.reduce((a, s) => a + s.durationSec, 0);
  const s = scenes[sel];
  const updS = (i: number, p: Partial<Scene>) => { setScenes(scenes.map((x, j) => (j === i ? { ...x, ...p } : x))); setDirty(true); };
  const moveS = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= scenes.length) return; const a = [...scenes]; [a[i], a[j]] = [a[j], a[i]]; setScenes(a); setSel(j); setDirty(true); };
  const aspectCls = { "9:16": "aspect-[9/16] max-h-[460px]", "16:9": "aspect-video", "1:1": "aspect-square max-h-[460px]", "4:5": "aspect-[4/5] max-h-[460px]" }[v.aspectRatio as string];

  async function save(silent = false) {
    setBusy("save");
    try { await api(`/api/videos/${id}`, { method: "PUT", body: { title: v.title, aspectRatio: v.aspectRatio, musicAssetId: v.musicAssetId, scenes } }); if (!silent) toast.success(t("تم الحفظ", "Saved")); await load(); return true; }
    catch (e) { toast.error(e); return false; } finally { setBusy(""); }
  }
  async function genImages() {
    if (dirty && !(await save(true))) return;
    const fresh = await api(`/api/videos/${id}`); const missing = fresh.scenes.filter((x: any) => !x.assetId && x.visualPrompt);
    if (!missing.length) { toast.info(t("كل المشاهد لديها صور", "All scenes have visuals")); return; }
    setBusy("images");
    for (const [k, sc] of missing.entries()) {
      try { toast.info(t(`توليد صورة المشهد ${sc.order + 1} (${k + 1}/${missing.length})`, `Generating scene ${sc.order + 1} (${k + 1}/${missing.length})`)); await api(`/api/videos/${id}/scenes/${sc.id}/image`, { method: "POST" }); }
      catch (e) { toast.error(e); break; }
    }
    await load(); setBusy("");
  }
  async function voice() { if (dirty && !(await save(true))) return; setBusy("voice"); try { await api(`/api/videos/${id}/voiceover`, { method: "POST" }); toast.success(t("تم توليد التعليق الصوتي وضبط مدد المشاهد", "Voice-over generated, durations adjusted")); await load(); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function render() { if (dirty && !(await save(true))) return; setBusy("render"); try { await api(`/api/videos/${id}/render`, { method: "POST" }); setV({ ...v, status: "rendering" }); toast.info(t("بدأ الإخراج في الخلفية — سنعلمك عند الانتهاء", "Rendering in background — you'll be notified")); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function rescript(durationSec: number) { setBusy("script"); setScriptOpen(false); try { await api(`/api/videos/${id}/script`, { body: { durationSec } }); await load(); setSel(0); toast.success(t("تم إنشاء سيناريو جديد", "New script created")); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  function play() {
    if (playing) { setPlaying(false); audio.current?.pause(); if (timer.current) clearTimeout(timer.current); return; }
    setPlaying(true); let i = 0;
    const step = () => { if (i >= scenes.length) { setPlaying(false); return; } setSel(i); const sc = scenes[i]; audio.current?.pause(); if (sc.voiceAssetId) { audio.current = new Audio(fileUrl(sc.voiceAssetId)); void audio.current.play(); } timer.current = setTimeout(() => { i++; step(); }, sc.durationSec * 1000); };
    step();
  }
  function usePost() { const a = assets[v.outputAssetId]; sessionStorage.setItem("ss_draft", JSON.stringify({ title: v.title, body: v.script?.caption ?? "", media: [{ asset: a }], variants: [] })); window.location.href = "/posts/new?from=studio"; }

  const visual = s?.assetId ? assets[s.assetId] : null;
  return <div>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Link href="/video" className="btn-ghost h-9 w-9 p-0"><ArrowRight className="h-4 w-4 ltr:rotate-180" /></Link>
      <Clapperboard className="h-5 w-5 text-primary" /><input className="input w-64 font-semibold" value={v.title} onChange={(e) => { setV({ ...v, title: e.target.value }); setDirty(true); }} />
      <StatusBadge status={v.status} />
      <select className="input w-auto" value={v.aspectRatio} onChange={(e) => { setV({ ...v, aspectRatio: e.target.value }); setDirty(true); }}>{["9:16", "16:9", "1:1", "4:5"].map((a) => <option key={a}>{a}</option>)}</select>
      <div className="flex-1" />
      <Button variant="outline" onClick={() => setScriptOpen(true)} loading={busy === "script"}><RefreshCw className="h-4 w-4" />{t("سيناريو جديد", "New script")}</Button>
      <Button variant="outline" onClick={genImages} loading={busy === "images"}><ImageIcon className="h-4 w-4" />{t("توليد صور المشاهد", "Generate scene images")}</Button>
      <Button variant="outline" onClick={voice} loading={busy === "voice"}><Mic className="h-4 w-4" />{t("التعليق الصوتي", "Voice-over")}</Button>
      <a href={`/api/videos/${id}/srt`} className="btn-outline"><Captions className="h-4 w-4" />SRT</a>
      <Button variant="outline" onClick={() => save()} loading={busy === "save"}><Save className="h-4 w-4" />{t("حفظ", "Save")}{dirty && " •"}</Button>
      <Button onClick={render} loading={busy === "render" || v.status === "rendering"}><Film className="h-4 w-4" />{v.status === "rendering" ? t("جاري الإخراج...", "Rendering...") : t("إخراج الفيديو", "Render video")}</Button>
    </div>
    {v.script?.hook && <Card className="mb-4 flex flex-wrap gap-4 p-4 text-sm"><div><Badge tone="primary">Hook</Badge> <span className="font-medium">{v.script.hook}</span></div>{v.script.caption && <div className="text-subtle">{v.script.caption} <span className="text-primary">{v.script.hashtags?.join(" ")}</span></div>}</Card>}
    {v.status === "failed" && v.renderError && <div className="mb-4"><ErrorBox error={new Error(v.renderError)} /></div>}

    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card className="grid gap-4 p-4 md:grid-cols-[minmax(0,280px)_1fr]">
          <div className="space-y-2">
            <div className={clsx("relative mx-auto w-full overflow-hidden rounded-xl bg-[#1f1b3a]", aspectCls)}>
              {visual && (visual.mimeType.startsWith("video/") ? <video src={fileUrl(visual.id)} muted autoPlay loop className="h-full w-full object-cover" /> : <img src={fileUrl(visual.id)} alt="" className="h-full w-full object-cover" />)}
              {s && (s.onScreenText || s.narration) && <div className="absolute inset-x-3 bottom-[12%] text-center"><span className="rounded bg-black/60 px-2 py-1 text-sm leading-7 text-white [box-decoration-break:clone]">{s.onScreenText || s.narration}</span></div>}
              <span className="absolute start-2 top-2 rounded bg-black/50 px-1.5 text-[11px] text-white">{sel + 1}/{scenes.length}</span>
            </div>
            <Button variant="outline" className="w-full" onClick={play}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{t("معاينة المشاهد", "Preview scenes")}</Button>
          </div>
          {s ? <div className="space-y-3">
            <div className="flex items-center gap-2"><h3 className="font-semibold">{t("المشهد", "Scene")} {sel + 1}</h3>{sel === 0 && <Badge tone="warning">Hook</Badge>}<div className="flex-1" />
              <button className="btn-ghost h-8 w-8 p-0" onClick={() => moveS(sel, -1)}><ArrowUp className="h-4 w-4" /></button><button className="btn-ghost h-8 w-8 p-0" onClick={() => moveS(sel, 1)}><ArrowDown className="h-4 w-4" /></button>
              <button className="btn-ghost h-8 w-8 p-0 text-danger" onClick={() => { setScenes(scenes.filter((_, j) => j !== sel)); setSel(Math.max(0, sel - 1)); setDirty(true); }}><Trash2 className="h-4 w-4" /></button></div>
            <Field label={t("نص التعليق الصوتي", "Voice-over narration")}><textarea className="input min-h-[80px]" value={s.narration} onChange={(e) => updS(sel, { narration: e.target.value })} /></Field>
            <Field label={t("النص على الشاشة / الترجمة", "On-screen text / caption")}><input className="input" value={s.onScreenText} onChange={(e) => updS(sel, { onScreenText: e.target.value })} /></Field>
            <Field label={t("الوصف البصري (لتوليد الصورة)", "Visual prompt (for image generation)")}><textarea className="input min-h-[60px]" dir="auto" value={s.visualPrompt} onChange={(e) => updS(sel, { visualPrompt: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label={t("المدة (ث)", "Duration (s)")}><input type="number" step={0.5} min={0.5} max={120} className="input" value={s.durationSec} onChange={(e) => updS(sel, { durationSec: Number(e.target.value) })} /></Field>
              <Field label={t("الانتقال", "Transition")}><select className="input" value={s.transition} onChange={(e) => updS(sel, { transition: e.target.value })}><option value="fade">Fade</option><option value="cut">Cut</option></select></Field>
              <Field label={t("الوسائط", "Visual")}><Button variant="outline" className="w-full" onClick={() => setPick("scene")}><ImageIcon className="h-4 w-4" /></Button></Field>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">{s.voiceAssetId ? <><Mic className="h-3.5 w-3.5 text-success" /><audio src={fileUrl(s.voiceAssetId)} controls className="h-8" /></> : <span className="text-subtle">{t("لا يوجد تعليق صوتي لهذا المشهد بعد", "No voice-over for this scene yet")}</span>}</div>
          </div> : <p className="text-sm text-subtle">{t("لا توجد مشاهد", "No scenes")}</p>}
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-subtle"><span>Timeline · {total.toFixed(1)}s</span><button className="flex items-center gap-1 text-primary" onClick={() => { setScenes([...scenes, { durationSec: 4, narration: "", onScreenText: "", visualPrompt: "", assetId: null, voiceAssetId: null, transition: "fade" }]); setSel(scenes.length); setDirty(true); }}><Plus className="h-3.5 w-3.5" />{t("مشهد", "Scene")}</button></div>
          <div className="space-y-1.5 overflow-x-auto">
            <div className="flex min-w-[600px] gap-0.5">{scenes.map((sc, i) => { const a = sc.assetId ? assets[sc.assetId] : null; return <button key={i} onClick={() => setSel(i)} style={{ flexGrow: sc.durationSec, flexBasis: 0 }} className={clsx("relative h-16 overflow-hidden rounded-md border-2 transition", i === sel ? "border-primary" : "border-transparent hover:border-border")}>
              {a ? (a.mimeType.startsWith("image/") ? <img src={fileUrl(a.id)} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-slate-800"><Film className="h-4 w-4 text-white" /></div>) : <div className="h-full w-full bg-muted" />}
              <span className="absolute bottom-0.5 start-1 rounded bg-black/60 px-1 text-[10px] text-white">{i + 1} · {sc.durationSec}s</span></button>; })}</div>
            <div className="flex min-w-[600px] gap-0.5">{scenes.map((sc, i) => <div key={i} style={{ flexGrow: sc.durationSec, flexBasis: 0 }} className={clsx("h-5 rounded-sm", sc.voiceAssetId ? "bg-success/40" : "bg-muted")} title="voice" />)}</div>
            <div className="flex min-w-[600px] items-center gap-2 rounded-sm bg-muted px-2 py-1 text-[11px]"><Music className="h-3 w-3" />{v.musicAssetId ? assets[v.musicAssetId]?.name : t("بدون موسيقى", "No music")}<button className="ms-auto text-primary" onClick={() => setPick("music")}>{t("اختيار موسيقى", "Choose music")}</button>{v.musicAssetId && <button className="text-danger" onClick={() => { setV({ ...v, musicAssetId: null }); setDirty(true); }}>×</button>}</div>
          </div>
          <p className="mt-2 text-[11px] text-subtle">{t("استخدم موسيقى مرخصة أو خالية من الحقوق فقط (ارفعها إلى مكتبة الملفات).", "Only use licensed or royalty-free music (upload it to the media library).")}</p>
        </Card>
      </div>

      <Card className="h-fit p-4">
        <h3 className="mb-3 font-semibold">{t("الفيديو النهائي", "Final video")}</h3>
        {v.status === "rendering" ? <div className="grid h-60 place-items-center text-center text-sm text-subtle"><div><Spinner className="mx-auto mb-2 h-6 w-6 text-primary" />{t("جاري الإخراج عبر FFmpeg...", "Rendering with FFmpeg...")}</div></div> :
          v.outputAssetId && assets[v.outputAssetId] ? <div className="space-y-2"><video src={fileUrl(v.outputAssetId)} controls className="max-h-[520px] w-full rounded-xl bg-black" />
            <div className="flex gap-2"><a className="btn-outline flex-1" href={fileUrl(v.outputAssetId) + "?download=1"}><Download className="h-4 w-4" />{t("تحميل", "Download")}</a><Button className="flex-1" onClick={usePost}><Send className="h-4 w-4" />{t("نشر", "Publish")}</Button></div>
            {dirty && <p className="text-xs text-warning">{t("لديك تعديلات لم تُخرج بعد", "You have unrendered changes")}</p>}</div> :
            <div className="grid h-60 place-items-center rounded-xl border border-dashed border-border text-center text-sm text-subtle"><div><Film className="mx-auto mb-2 h-6 w-6" />{t("اضغط \"إخراج الفيديو\" لدمج المشاهد والصوت والترجمة في ملف MP4", "Click \"Render video\" to merge scenes, audio and captions into an MP4")}</div></div>}
        <ol className="mt-4 space-y-1.5 text-xs text-subtle">{[[t("السيناريو والمشاهد", "Script & scenes"), scenes.length > 0], [t("صور/مقاطع المشاهد", "Scene visuals"), scenes.length > 0 && scenes.every((x) => x.assetId)], [t("التعليق الصوتي", "Voice-over"), scenes.length > 0 && scenes.every((x) => x.voiceAssetId || !x.narration)], [t("الإخراج", "Render"), v.status === "rendered"]].map(([l, ok], i) => <li key={i} className="flex items-center gap-2"><span className={clsx("h-2 w-2 rounded-full", ok ? "bg-success" : "bg-border")} />{l as string}</li>)}</ol>
      </Card>
    </div>
    <MediaPicker open={!!pick} kind={pick === "music" ? "audio" : undefined} onClose={() => setPick(null)} onPick={(as) => { const a = as[0]; if (!a) return; setAssets({ ...assets, [a.id]: a }); if (pick === "music") { setV({ ...v, musicAssetId: a.id }); setDirty(true); } else updS(sel, { assetId: a.id }); }} />
    <Modal open={scriptOpen} onClose={() => setScriptOpen(false)} size="sm" title={t("إعادة كتابة السيناريو", "Rewrite script")}><RescriptForm onGo={rescript} /></Modal>
  </div>;
}
function RescriptForm({ onGo }: { onGo: (d: number) => void }) {
  const t = useT(); const [d, setD] = useState(45);
  return <div className="space-y-3"><p className="text-sm text-warning">{t("سيستبدل المشاهد الحالية.", "This replaces the current scenes.")}</p><Field label={t("المدة المستهدفة (ثانية)", "Target duration (s)")}><input type="number" className="input" value={d} onChange={(e) => setD(Number(e.target.value))} /></Field><Button onClick={() => onGo(d)}><Wand2 className="h-4 w-4" />{t("إنشاء", "Generate")}</Button></div>;
}
