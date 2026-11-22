"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Palette, Wand2, LayoutTemplate, FilePlus } from "lucide-react";
import clsx from "clsx";
import { useT } from "@/components/i18n";
import { Card, PageHeader, Button, Field, Toggle, useToast } from "@/components/ui";
import { SIZE_PRESETS } from "@/lib/platforms";
import { TEMPLATES } from "@/lib/design";
import { api } from "@/lib/client";

function NewDesign() {
  const t = useT(); const toast = useToast(); const router = useRouter(); const sp = useSearchParams();
  const [preset, setPreset] = useState(sp.get("preset") ?? "instagram_post"); const [prompt, setPrompt] = useState(sp.get("prompt") ?? "");
  const [withImage, setWithImage] = useState(true); const [busy, setBusy] = useState("");
  const p = SIZE_PRESETS[preset as keyof typeof SIZE_PRESETS];
  async function ai() { setBusy("ai"); try { const r = await api("/api/designs/ai", { body: { prompt, preset, withImage } }); if (r.imageError) toast.info(t("أُنشئ التصميم بدون صورة خلفية: ", "Created without AI background: ") + r.imageError); router.push(`/design/${r.design.id}`); } catch (e) { toast.error(e); setBusy(""); } }
  async function create(templateId?: string) { setBusy(templateId ?? "blank"); try { const d = await api("/api/designs", { body: { name: templateId ? TEMPLATES.find((x) => x.id === templateId)!.ar : t("تصميم جديد", "New design"), preset, templateId } }); router.push(`/design/${d.id}`); } catch (e) { toast.error(e); setBusy(""); } }
  return <div>
    <PageHeader icon={<Palette />} title={t("تصميم جديد", "New design")} />
    <Card className="mb-4 p-5"><label className="label">{t("المقاس", "Size")}</label>
      <div className="flex flex-wrap gap-2">{Object.entries(SIZE_PRESETS).map(([k, v]) => <button key={k} onClick={() => setPreset(k)} className={clsx("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition", preset === k ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
        <span className="inline-block rounded-sm border-2 border-current opacity-60" style={{ width: (v.width / Math.max(v.width, v.height)) * 18, height: (v.height / Math.max(v.width, v.height)) * 18 }} />{t(v.nameAr, v.name)}<span className="text-[11px] text-subtle" dir="ltr">{v.width}×{v.height}</span></button>)}</div>
    </Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="bg-gradient-to-br from-primary/10 to-transparent p-5"><h3 className="mb-3 flex items-center gap-2 font-semibold"><Wand2 className="h-4 w-4 text-primary" />{t("صمم بالذكاء الاصطناعي", "Design with AI")}</h3>
        <Field label={t("صف التصميم", "Describe the design")}><textarea className="input min-h-[120px]" placeholder={t("صمم إعلانًا احترافيًا عن خصم 20% على المنتجات", "Design a professional ad for 20% off all products")} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></Field>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><Toggle checked={withImage} onChange={setWithImage} label={t("توليد صورة خلفية بالذكاء الاصطناعي", "Generate AI background image")} /><Button onClick={ai} loading={busy === "ai"} disabled={prompt.trim().length < 3}><Wand2 className="h-4 w-4" />{t("صمّم", "Design it")}</Button></div>
        <p className="mt-2 text-xs text-subtle">{t("يستخدم ألوان وخطوط وشعار هويتك التجارية الافتراضية. النتيجة تصميم قابل للتعديل بالكامل.", "Uses your default brand colors, fonts and logo. The result is fully editable.")} ({p?.width}×{p?.height})</p>
      </Card>
      <Card className="p-5"><h3 className="mb-3 flex items-center gap-2 font-semibold"><LayoutTemplate className="h-4 w-4 text-primary" />{t("ابدأ من قالب", "Start from a template")}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{TEMPLATES.map((x) => <button key={x.id} disabled={!!busy} onClick={() => create(x.id)} className="overflow-hidden rounded-xl border border-border text-start transition hover:border-primary hover:shadow-pop">
          <div className="grid h-20 place-items-center p-2 text-center text-sm font-bold" style={{ background: `linear-gradient(135deg, ${x.palette.background}, ${x.palette.backgroundAlt})`, color: x.palette.text }}>{x.copy.headline}</div>
          <div className="px-2 py-1.5 text-xs">{t(x.ar, x.en)}</div></button>)}</div>
        <Button variant="outline" className="mt-3 w-full" loading={busy === "blank"} onClick={() => create()}><FilePlus className="h-4 w-4" />{t("لوحة فارغة", "Blank canvas")}</Button>
      </Card>
    </div>
  </div>;
}
export default function Page() { return <Suspense><NewDesign /></Suspense>; }
