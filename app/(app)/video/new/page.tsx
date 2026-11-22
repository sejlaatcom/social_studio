"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clapperboard, Wand2, Images, FileText } from "lucide-react";
import { useT } from "@/components/i18n";
import { Card, PageHeader, Button, Field, Tabs, useToast } from "@/components/ui";
import { MediaPicker, AssetThumb, type Asset } from "@/components/media";
import { api } from "@/lib/client";

const TYPES: [string, string, string][] = [["marketing", "تسويقي", "Marketing"], ["educational", "تعليمي", "Educational"], ["ad", "إعلاني", "Ad"], ["explainer", "شرح", "Explainer"], ["news", "أخبار", "News"], ["occasion", "مناسبات", "Occasion"], ["shorts", "Shorts/Reels/TikTok", "Shorts/Reels/TikTok"], ["story", "Story", "Story"], ["youtube_long", "يوتيوب طويل", "Long YouTube"]];

function NewVideo() {
  const t = useT(); const toast = useToast(); const router = useRouter(); const sp = useSearchParams();
  const [mode, setMode] = useState<"idea" | "article" | "images">(sp.get("source") ? "article" : "idea");
  const [f, setF] = useState({ topic: sp.get("topic") ?? "", videoType: "marketing", aspectRatio: sp.get("aspect") ?? "9:16", language: "ar", dialect: "msa", durationSec: 45, sourceText: sp.get("source") ?? "" });
  const [images, setImages] = useState<Asset[]>([]); const [pick, setPick] = useState(false); const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });
  async function create() {
    setBusy(true);
    try { const v = await api("/api/videos", { body: { ...f, durationSec: Number(f.durationSec), sourceText: mode === "article" ? f.sourceText : undefined, imageAssetIds: mode === "images" ? images.map((i) => i.id) : undefined, dialect: f.language === "ar" ? f.dialect : undefined } }); router.push(`/video/${v.id}`); }
    catch (e) { toast.error(e); setBusy(false); }
  }
  return <div className="mx-auto max-w-3xl">
    <PageHeader icon={<Clapperboard />} title={t("فيديو جديد", "New video")} subtitle={t("سيكتب الذكاء الاصطناعي السيناريو ويقسمه إلى مشاهد قابلة للتعديل", "AI writes the script and splits it into editable scenes")} />
    <Card className="space-y-4 p-6">
      <Tabs value={mode} onChange={setMode} items={[{ value: "idea", label: <span className="flex items-center gap-1"><Wand2 className="h-3.5 w-3.5" />{t("من فكرة", "From idea")}</span> }, { value: "article", label: <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{t("من مقال/منشور", "From article/post")}</span> }, { value: "images", label: <span className="flex items-center gap-1"><Images className="h-3.5 w-3.5" />{t("من صور", "From images")}</span> }]} />
      <Field label={t("موضوع الفيديو *", "Video topic *")}><textarea className="input min-h-[80px]" value={f.topic} onChange={(e) => set("topic", e.target.value)} /></Field>
      {mode === "article" && <Field label={t("النص المصدر", "Source text")}><textarea className="input min-h-[160px]" value={f.sourceText} onChange={(e) => set("sourceText", e.target.value)} /></Field>}
      {mode === "images" && <div><label className="label">{t("الصور (مشهد لكل صورة)", "Images (one scene each)")}</label><div className="flex flex-wrap gap-2">{images.map((a) => <div key={a.id} className="h-20 w-20 overflow-hidden rounded-lg"><AssetThumb a={a} /></div>)}<button className="grid h-20 w-20 place-items-center rounded-lg border-2 border-dashed border-border text-xs text-subtle" onClick={() => setPick(true)}>+</button></div></div>}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Field label={t("النوع", "Type")}><select className="input" value={f.videoType} onChange={(e) => set("videoType", e.target.value)}>{TYPES.map(([v, a, e]) => <option key={v} value={v}>{t(a, e)}</option>)}</select></Field>
        <Field label={t("النسبة", "Aspect")}><select className="input" value={f.aspectRatio} onChange={(e) => set("aspectRatio", e.target.value)}><option value="9:16">9:16 (TikTok/Reels/Shorts)</option><option value="16:9">16:9 (YouTube)</option><option value="1:1">1:1</option><option value="4:5">4:5</option></select></Field>
        <Field label={t("المدة (ثانية)", "Duration (s)")}><input type="number" min={10} max={1200} className="input" value={f.durationSec} onChange={(e) => set("durationSec", e.target.value)} /></Field>
        <Field label={t("اللغة", "Language")}><select className="input" value={f.language} onChange={(e) => set("language", e.target.value)}><option value="ar">العربية</option><option value="en">English</option></select></Field>
      </div>
      <div className="flex justify-end"><Button onClick={create} loading={busy} disabled={f.topic.trim().length < 3 || (mode === "images" && !images.length)}><Wand2 className="h-4 w-4" />{busy ? t("جاري كتابة السيناريو...", "Writing script...") : t("إنشاء السيناريو والمشاهد", "Create script & scenes")}</Button></div>
    </Card>
    <MediaPicker open={pick} kind="image" multiple onClose={() => setPick(false)} onPick={(a) => setImages([...images, ...a])} />
  </div>;
}
export default function Page() { return <Suspense><NewVideo /></Suspense>; }
