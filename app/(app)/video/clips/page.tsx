"use client";
import { useState } from "react";
import { Scissors, Film, Wand2, Captions, Download } from "lucide-react";
import { useT } from "@/components/i18n";
import { Card, PageHeader, Button, Field, Toggle, useToast } from "@/components/ui";
import { MediaPicker, fileUrl, type Asset } from "@/components/media";
import { api } from "@/lib/client";

type Seg = { start: number; end: number; text: string };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function Clips() {
  const t = useT(); const toast = useToast();
  const [video, setVideo] = useState<Asset | null>(null); const [pick, setPick] = useState(false);
  const [segments, setSegments] = useState<Seg[] | null>(null); const [clips, setClips] = useState<{ start: number; end: number; title: string; hook: string; asset?: Asset }[]>([]);
  const [busy, setBusy] = useState(""); const [burn, setBurn] = useState(true); const [count, setCount] = useState(3); const [manual, setManual] = useState({ start: 0, end: 30 });
  async function transcribe() { setBusy("stt"); try { const r = await api("/api/videos/clips/transcribe", { body: { assetId: video!.id } }); setSegments(r.segments); toast.success(t("تم التفريغ النصي", "Transcribed")); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function suggest() { setBusy("suggest"); try { const r = await api("/api/videos/clips/suggest", { body: { segments, count } }); setClips(r.clips); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function cut(i: number | "manual") {
    const c = i === "manual" ? { ...manual, title: `${video!.name} ${fmt(manual.start)}`, hook: "" } : clips[i];
    setBusy(`cut${i}`);
    try { const a = await api("/api/videos/clips/cut", { body: { assetId: video!.id, start: c.start, end: c.end, title: c.title, burnSubtitles: burn && !!segments, segments: segments ?? undefined } });
      if (i === "manual") setClips([...clips, { ...c, asset: a }]); else setClips(clips.map((x, j) => (j === i ? { ...x, asset: a } : x)));
      toast.success(t("تم إنشاء المقطع العمودي وحفظه في المكتبة", "Vertical clip created and saved")); }
    catch (e) { toast.error(e); } finally { setBusy(""); }
  }
  return <div>
    <PageHeader icon={<Scissors />} title={t("استخراج مقاطع قصيرة من فيديو طويل", "Extract short clips from a long video")} subtitle={t("تفريغ نصي ← اقتراح أقوى اللحظات ← قص وتحويل إلى 9:16 مع ترجمة", "Transcribe → AI picks the best moments → cut to 9:16 with captions")} />
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card className="space-y-3 p-5">
        {video ? <video src={fileUrl(video.id)} controls className="max-h-80 w-full rounded-xl bg-black" /> : <button onClick={() => setPick(true)} className="grid h-60 w-full place-items-center rounded-xl border-2 border-dashed border-border text-subtle hover:border-primary"><div className="text-center"><Film className="mx-auto mb-2 h-8 w-8" />{t("اختر فيديو طويلًا من المكتبة", "Pick a long video from the library")}</div></button>}
        {video && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setPick(true)}>{t("تغيير", "Change")}</Button><Button onClick={transcribe} loading={busy === "stt"}><Captions className="h-4 w-4" />{t("تفريغ نصي (Speech-to-Text)", "Transcribe")}</Button></div>}
        {segments && <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl bg-muted/50 p-3 text-xs leading-6">{segments.map((s, i) => <p key={i}><span className="text-primary" dir="ltr">[{fmt(s.start)}]</span> {s.text}</p>)}</div>}
      </Card>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-end gap-2"><Field label={t("عدد المقاطع", "Clips")}><input type="number" min={1} max={10} className="input w-24" value={count} onChange={(e) => setCount(Number(e.target.value))} /></Field><Button onClick={suggest} loading={busy === "suggest"} disabled={!segments}><Wand2 className="h-4 w-4" />{t("اقترح أفضل المقاطع", "Suggest best clips")}</Button><div className="flex-1" /><Toggle checked={burn} onChange={setBurn} label={t("ترجمة مدمجة", "Burn captions")} /></div>
        {clips.map((c, i) => <div key={i} className="rounded-xl border border-border p-3"><div className="flex items-center gap-2"><b className="flex-1 text-sm">{c.title}</b><span className="text-xs text-subtle" dir="ltr">{fmt(c.start)}–{fmt(c.end)}</span></div>{c.hook && <p className="mt-1 text-xs text-subtle">🎯 {c.hook}</p>}
          {c.asset ? <div className="mt-2 flex items-center gap-2"><video src={fileUrl(c.asset.id)} controls className="h-48 rounded-lg bg-black" /><a href={fileUrl(c.asset.id) + "?download=1"} className="btn-outline"><Download className="h-4 w-4" /></a></div> : <Button className="mt-2" variant="outline" onClick={() => cut(i)} loading={busy === `cut${i}`}><Scissors className="h-4 w-4" />{t("قص وتحويل إلى 9:16", "Cut to 9:16")}</Button>}</div>)}
        {video && <div className="rounded-xl bg-muted/50 p-3"><div className="mb-2 text-xs font-medium">{t("قص يدوي", "Manual cut")}</div><div className="flex flex-wrap items-end gap-2"><Field label={t("من (ث)", "From (s)")}><input type="number" className="input w-24" value={manual.start} onChange={(e) => setManual({ ...manual, start: Number(e.target.value) })} /></Field><Field label={t("إلى (ث)", "To (s)")}><input type="number" className="input w-24" value={manual.end} onChange={(e) => setManual({ ...manual, end: Number(e.target.value) })} /></Field><Button variant="outline" onClick={() => cut("manual")} loading={busy === "cutmanual"}><Scissors className="h-4 w-4" />{t("قص", "Cut")}</Button></div></div>}
      </Card>
    </div>
    <MediaPicker open={pick} kind="video" onClose={() => setPick(false)} onPick={(a) => { setVideo(a[0]); setSegments(null); setClips([]); }} />
  </div>;
}
