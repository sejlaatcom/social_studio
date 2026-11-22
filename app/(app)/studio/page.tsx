"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, Wand2, Copy, Send, Image as ImageIcon, Clapperboard, Palette, Mail, Lightbulb, Hash, Settings } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT } from "@/components/i18n";
import { Card, PageHeader, Button, Field, Badge, useToast, Skeleton, ErrorBox } from "@/components/ui";
import { PlatformIcon } from "@/components/platform-icon";
import { AssetThumb, type Asset } from "@/components/media";
import { newVariant, type Variant } from "@/components/composer";
import { api } from "@/lib/client";

const TONES: [string, string, string][] = [["marketing", "تسويقي", "Marketing"], ["professional", "احترافي", "Professional"], ["formal", "رسمي", "Formal"], ["friendly", "ودود", "Friendly"], ["educational", "تعليمي", "Educational"], ["entertaining", "ترفيهي", "Entertaining"], ["creative", "إبداعي", "Creative"], ["enthusiastic", "حماسي", "Enthusiastic"], ["concise", "مختصر", "Concise"], ["detailed", "تفصيلي", "Detailed"]];
const DIALECTS: [string, string, string][] = [["msa", "الفصحى", "MSA"], ["saudi", "السعودية", "Saudi"], ["gulf", "الخليجية", "Gulf"], ["egyptian", "المصرية", "Egyptian"], ["levantine", "الشامية", "Levantine"], ["maghrebi", "المغاربية", "Maghrebi"], ["iraqi", "العراقية", "Iraqi"]];

function Studio() {
  const t = useT(); const toast = useToast(); const router = useRouter(); const sp = useSearchParams();
  const { data: kits } = useApi<any[]>("/api/brand-kits"); const { data: status } = useApi<any>("/api/ai/status");
  const [idea, setIdea] = useState(sp.get("idea") ?? ""); const [tone, setTone] = useState("marketing"); const [language, setLanguage] = useState("ar"); const [dialect, setDialect] = useState("msa"); const [brandKitId, setBrandKitId] = useState("");
  const [pack, setPack] = useState<any>(null); const [ideaId, setIdeaId] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const [selected, setSelected] = useState<string[]>(["instagram", "x", "tiktok", "youtube", "snapchat", "gmail"]);
  const [images, setImages] = useState<Asset[]>([]); const [imgBusy, setImgBusy] = useState<number | null>(null);

  useEffect(() => { const k = kits?.find((x) => x.isDefault); if (k && !brandKitId) { setBrandKitId(k.id); if (k.dialect) setDialect(k.dialect); if (k.language) setLanguage(k.language); } }, [kits, brandKitId]);
  useEffect(() => { const id = sp.get("ideaId"); if (id) api(`/api/ideas/${id}`).then((i) => { setIdea(i.body || i.title); if (i.generated) { setPack(i.generated); setIdeaId(i.id); } }).catch(() => {}); }, [sp]);

  async function generate() {
    setBusy(true); setErr(null); setPack(null);
    try { const r = await api("/api/ai/content-pack", { body: { idea, tone, language, dialect: language === "ar" ? dialect : "en", brandKitId: brandKitId || null } }); setPack(r.pack); setIdeaId(r.ideaId); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  }
  async function genImage(i: number, prompt: string) {
    setImgBusy(i);
    try { const a = await api<Asset>("/api/ai/image", { body: { prompt, width: 1080, height: 1350, tags: ["studio"] } }); setImages((x) => [...x, a]); toast.success(t("تم توليد الصورة وحفظها في المكتبة", "Image generated and saved to library")); }
    catch (e) { toast.error(e); } finally { setImgBusy(null); }
  }
  const copy = (s: string) => { void navigator.clipboard.writeText(s); toast.success(t("تم النسخ", "Copied")); };

  function toDraft() {
    const variants: Variant[] = selected.map((p) => {
      const v = newVariant(p, null, "");
      if (p === "instagram") Object.assign(v, { text: pack.instagram.caption, hashtags: pack.instagram.hashtags });
      if (p === "x") Object.assign(v, { text: pack.x.post, threadParts: pack.x.thread });
      if (p === "tiktok") Object.assign(v, { text: pack.tiktok.caption, hashtags: pack.tiktok.hashtags });
      if (p === "youtube") Object.assign(v, { title: pack.youtube.title, text: pack.youtube.description, hashtags: pack.youtube.tags.map((x: string) => "#" + x.replace(/^#/, "").replace(/\s+/g, "_")).slice(0, 15) });
      if (p === "snapchat") Object.assign(v, { text: pack.snapchat.storyText });
      if (p === "gmail") Object.assign(v, { title: pack.email.subject, text: `${pack.email.headline}\n\n${pack.email.body}\n\n${pack.email.ctaLabel}` });
      return v;
    });
    const media = images.map((a) => ({ asset: a, altText: pack.instagram.altText }));
    sessionStorage.setItem("ss_draft", JSON.stringify({ title: pack.headline, body: pack.body, ideaId, media, variants }));
    router.push("/posts/new?from=studio");
  }

  return <div>
    <PageHeader icon={<Sparkles />} title={t("مركز صناعة المحتوى الذكي", "AI Content Studio")} subtitle={t("فكرة واحدة ← محتوى مخصص لكل منصة، بهويتك التجارية", "One idea → tailored content for every platform, in your brand voice")}
      actions={<Link href="/ideas" className="btn-outline"><Lightbulb className="h-4 w-4" />{t("بنك الأفكار", "Ideas bank")}</Link>} />
    {status && !status.ready.llm && <Card className="mb-4 flex flex-wrap items-center gap-3 border-warning/40 bg-warning/5 p-4 text-sm"><Settings className="h-4 w-4 text-warning" /><span className="flex-1">{t("لم يتم إعداد مفتاح مزود النماذج اللغوية بعد.", "The language-model provider key isn't configured yet.")}</span><Link href="/settings?tab=ai" className="btn-outline">{t("إعداد الذكاء الاصطناعي", "Configure AI")}</Link></Card>}
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-transparent p-5">
        <textarea className="input min-h-[110px] border-0 bg-surface/80 text-base leading-8 shadow-sm" placeholder={t("اكتب فكرتك... مثال: أريد إعلانًا عن منتج جديد في متجري — عطر صيفي بخصم 20% لمدة أسبوع", "Write your idea… e.g. announce a new summer perfume with 20% off for one week")} value={idea} onChange={(e) => setIdea(e.target.value)} />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label={t("الأسلوب", "Tone")}><select className="input w-auto" value={tone} onChange={(e) => setTone(e.target.value)}>{TONES.map(([v, a, e]) => <option key={v} value={v}>{t(a, e)}</option>)}</select></Field>
          <Field label={t("اللغة", "Language")}><select className="input w-auto" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="ar">العربية</option><option value="en">English</option></select></Field>
          {language === "ar" && <Field label={t("اللهجة", "Dialect")}><select className="input w-auto" value={dialect} onChange={(e) => setDialect(e.target.value)}>{DIALECTS.map(([v, a, e]) => <option key={v} value={v}>{t(a, e)}</option>)}</select></Field>}
          <Field label={t("الهوية", "Brand")}><select className="input w-auto" value={brandKitId} onChange={(e) => setBrandKitId(e.target.value)}><option value="">{t("بدون", "None")}</option>{kits?.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>
          <div className="flex-1" />
          <Button onClick={generate} loading={busy} disabled={idea.trim().length < 3} className="h-11 px-6"><Wand2 className="h-4 w-4" />{t("ابتكر المحتوى", "Generate content")}</Button>
        </div>
      </div>
    </Card>

    {err ? <div className="mt-4"><ErrorBox error={err} onRetry={generate} /></div> : null}
    {busy && <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>}

    {pack && !busy && <div className="mt-6 space-y-4 animate-in">
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1"><Badge tone="primary">{t("العنوان", "Headline")}</Badge><h2 className="mt-2 text-xl font-bold leading-relaxed">{pack.headline}</h2>
            <p className="mt-3 whitespace-pre-wrap leading-8">{pack.body}</p>
            <p className="mt-3 rounded-xl bg-primary/5 p-3 text-sm"><b>CTA:</b> {pack.cta}</p>
            <div className="mt-3 flex flex-wrap gap-1">{pack.hashtags.map((h: string) => <span key={h} className="chip bg-muted text-primary">{h}</span>)}</div></div>
          <div className="w-full space-y-2 rounded-2xl border border-border p-4 sm:w-72">
            <div className="text-sm font-semibold">{t("تحويل إلى منشور متعدد المنصات", "Turn into a multi-platform post")}</div>
            <div className="flex flex-wrap gap-1.5">{["instagram", "x", "tiktok", "youtube", "snapchat", "gmail"].map((p) => { const on = selected.includes(p); return <button key={p} onClick={() => setSelected(on ? selected.filter((x) => x !== p) : [...selected, p])} className={`rounded-lg border p-1 ${on ? "border-primary bg-primary/10" : "border-border opacity-40"}`}><PlatformIcon platform={p} size={22} /></button>; })}</div>
            <Button className="w-full" onClick={toDraft} disabled={!selected.length}><Send className="h-4 w-4" />{t("فتح في محرر النشر", "Open in publisher")}</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Block title={t("نسخة مختصرة", "Short version")} text={pack.shortVersion} onCopy={copy} />
          <Block title={t("نسخة مطولة", "Long version")} text={pack.longVersion} onCopy={copy} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PCard p="instagram" title="Instagram" onCopy={copy} text={`${pack.instagram.caption}\n\n${pack.instagram.hashtags.join(" ")}`} extra={<p className="text-xs text-subtle"><b>Alt:</b> {pack.instagram.altText}</p>} />
        <PCard p="instagram" title="Reel" onCopy={copy} text={`🎬 Hook: ${pack.reel.hook}\n\n${pack.reel.script}\n\n${pack.reel.caption}`} />
        <PCard p="instagram" title="Story" onCopy={copy} text={pack.story.frames.map((f: string, i: number) => `${i + 1}. ${f}`).join("\n")} />
        <PCard p="x" title={t("منشور X", "X post")} onCopy={copy} text={pack.x.post} />
        <PCard p="x" title={t("سلسلة تغريدات", "X thread")} onCopy={copy} text={pack.x.thread.join("\n\n")} />
        <PCard p="tiktok" title="TikTok" onCopy={copy} text={`🎬 Hook: ${pack.tiktok.hook}\n\n${pack.tiktok.script}\n\n${pack.tiktok.caption} ${pack.tiktok.hashtags.join(" ")}`} action={<Link href={`/video/new?topic=${encodeURIComponent(pack.tiktok.hook + " — " + idea)}&aspect=9:16`} className="btn-outline h-7 px-2 text-xs"><Clapperboard className="h-3 w-3" />{t("فيديو", "Video")}</Link>} />
        <PCard p="youtube" title="YouTube" onCopy={copy} text={`${pack.youtube.title}\n\n${pack.youtube.description}\n\nTags: ${pack.youtube.tags.join(", ")}`} action={<Link href={`/design/new?preset=youtube_thumbnail&prompt=${encodeURIComponent(pack.youtube.thumbnailText + " — " + pack.youtube.title)}`} className="btn-outline h-7 px-2 text-xs"><Palette className="h-3 w-3" />Thumbnail</Link>} />
        <PCard p="youtube" title="YouTube Shorts" onCopy={copy} text={pack.youtube.shortsScript} action={<Link href={`/video/new?topic=${encodeURIComponent(idea)}&aspect=9:16&source=${encodeURIComponent(pack.youtube.shortsScript.slice(0, 1500))}`} className="btn-outline h-7 px-2 text-xs"><Clapperboard className="h-3 w-3" />{t("فيديو", "Video")}</Link>} />
        <PCard p="snapchat" title="Snapchat" onCopy={copy} text={`${pack.snapchat.storyText}\n\n${pack.snapchat.frames.map((f: string, i: number) => `${i + 1}. ${f}`).join("\n")}`} />
        <PCard p="gmail" title={t("بريد تسويقي", "Marketing email")} onCopy={copy} text={`${t("الموضوع", "Subject")}: ${pack.email.subject}\n${pack.email.preheader}\n\n${pack.email.headline}\n\n${pack.email.body}\n\n[${pack.email.ctaLabel}]`} action={<Link href={`/email?subject=${encodeURIComponent(pack.email.subject)}&headline=${encodeURIComponent(pack.email.headline)}&body=${encodeURIComponent(pack.email.body)}&cta=${encodeURIComponent(pack.email.ctaLabel)}`} className="btn-outline h-7 px-2 text-xs"><Mail className="h-3 w-3" />{t("حملة", "Campaign")}</Link>} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5"><h3 className="mb-3 flex items-center gap-2 font-semibold"><ImageIcon className="h-4 w-4 text-primary" />{t("أفكار الصور", "Image ideas")}</h3>
          <div className="space-y-2">{pack.imageIdeas.map((x: string, i: number) => <div key={i} className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm"><span className="flex-1 leading-6">{x}</span>
            <div className="flex shrink-0 flex-col gap-1"><Button variant="outline" className="h-7 px-2 text-xs" loading={imgBusy === i} onClick={() => genImage(i, x)}>{t("توليد", "Generate")}</Button><Link href={`/design/new?prompt=${encodeURIComponent(x)}`} className="btn-ghost h-7 px-2 text-xs">{t("تصميم", "Design")}</Link></div></div>)}</div>
          {images.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{images.map((a) => <div key={a.id} className="h-24 w-20 overflow-hidden rounded-lg"><AssetThumb a={a} /></div>)}</div>}
        </Card>
        <Card className="p-5"><h3 className="mb-3 flex items-center gap-2 font-semibold"><Clapperboard className="h-4 w-4 text-primary" />{t("أفكار الفيديو", "Video ideas")}</h3>
          <div className="space-y-2">{pack.videoIdeas.map((x: string, i: number) => <div key={i} className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm"><span className="flex-1 leading-6">{x}</span><Link href={`/video/new?topic=${encodeURIComponent(x)}`} className="btn-outline h-7 shrink-0 px-2 text-xs">{t("إنشاء", "Create")}</Link></div>)}</div>
        </Card>
      </div>
    </div>}
  </div>;
}

function Block({ title, text, onCopy }: { title: string; text: string; onCopy: (s: string) => void }) {
  return <div className="rounded-xl border border-border p-3"><div className="mb-1 flex items-center justify-between text-xs font-medium text-subtle">{title}<button onClick={() => onCopy(text)}><Copy className="h-3.5 w-3.5" /></button></div><p className="whitespace-pre-wrap text-sm leading-7">{text}</p></div>;
}
function PCard({ p, title, text, onCopy, extra, action }: { p: string; title: string; text: string; onCopy: (s: string) => void; extra?: React.ReactNode; action?: React.ReactNode }) {
  return <Card className="flex flex-col p-4 transition hover:shadow-pop"><div className="mb-2 flex items-center gap-2"><PlatformIcon platform={p} size={22} /><b className="flex-1 text-sm">{title}</b>{action}<button className="btn-ghost h-7 w-7 p-0" onClick={() => onCopy(text)}><Copy className="h-3.5 w-3.5" /></button></div>
    <p className="max-h-72 flex-1 overflow-y-auto whitespace-pre-wrap text-sm leading-7">{text}</p>{extra}<div className="mt-2 flex items-center gap-1 text-[11px] text-subtle"><Hash className="h-3 w-3" />{[...text].length}</div></Card>;
}
export default function Page() { return <Suspense><Studio /></Suspense>; }
