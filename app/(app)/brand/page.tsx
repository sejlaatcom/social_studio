"use client";
import { useEffect, useState } from "react";
import { Gem, Plus, Save, Trash2, Star, ImagePlus } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT } from "@/components/i18n";
import { Card, PageHeader, Button, Field, TagInput, SkeletonList, EmptyState, Confirm, Badge, useToast } from "@/components/ui";
import { MediaPicker, fileUrl } from "@/components/media";
import { usePerms } from "@/components/shell";
import { api } from "@/lib/client";

const FONTS = ["IBM Plex Sans Arabic", "Cairo", "Tajawal", "Amiri", "Changa", "Inter", "Poppins"];
const DIALECTS: [string, string, string][] = [["msa", "الفصحى", "MSA"], ["saudi", "سعودية", "Saudi"], ["gulf", "خليجية", "Gulf"], ["egyptian", "مصرية", "Egyptian"], ["levantine", "شامية", "Levantine"], ["maghrebi", "مغاربية", "Maghrebi"], ["iraqi", "عراقية", "Iraqi"]];
const empty = { name: "", description: "", colors: [{ name: "Primary", hex: "#6d5dfc" }, { name: "Secondary", hex: "#111827" }, { name: "Accent", hex: "#f59e0b" }], fonts: [{ role: "heading", family: "Cairo" }, { role: "body", family: "IBM Plex Sans Arabic" }], toneOfVoice: "", audience: "", products: "", services: "", values: "", language: "ar", dialect: "msa", hashtags: [], forbiddenWords: [], website: "", logoAssetId: null, isDefault: false };

export default function Brand() {
  const t = useT(); const toast = useToast(); const can = usePerms();
  const { data: kits, loading, reload } = useApi<any[]>("/api/brand-kits");
  const [sel, setSel] = useState<string | "new" | null>(null); const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false); const [pick, setPick] = useState(false); const [del, setDel] = useState(false);
  useEffect(() => { if (kits && sel === null) setSel(kits[0]?.id ?? "new"); }, [kits, sel]);
  useEffect(() => { if (sel === "new") setF({ ...empty }); else if (sel && kits) { const k = kits.find((x) => x.id === sel); if (k) setF({ ...k }); } }, [sel, kits]);
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });
  async function save() {
    setBusy(true);
    try {
      const payload = { ...f }; ["id", "workspaceId", "createdAt", "updatedAt"].forEach((k) => delete payload[k]);
      const r = sel === "new" ? await api("/api/brand-kits", { body: payload }) : await api(`/api/brand-kits/${sel}`, { method: "PATCH", body: payload });
      toast.success(t("تم حفظ الهوية", "Brand kit saved")); await reload(true); setSel(r.id);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  }
  async function remove() { try { await api(`/api/brand-kits/${sel}`, { method: "DELETE" }); setDel(false); setSel(null); await reload(true); toast.success(t("تم الحذف", "Deleted")); } catch (e) { toast.error(e); } }

  return <div>
    <PageHeader icon={<Gem />} title={t("الهوية التجارية", "Brand Kit")} subtitle={t("يستخدم الذكاء الاصطناعي هويتك تلقائيًا في كل محتوى وتصميم", "AI uses your brand automatically in every piece of content and design")}
      actions={can("brand.manage") && <Button variant="outline" onClick={() => setSel("new")}><Plus className="h-4 w-4" />{t("علامة جديدة", "New brand")}</Button>} />
    {loading ? <SkeletonList /> : <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        {kits?.length === 0 && sel !== "new" && <EmptyState icon={<Gem />} title={t("لا توجد علامات", "No brands")} />}
        {kits?.map((k) => <button key={k.id} onClick={() => setSel(k.id)} className={`card flex w-full items-center gap-3 p-3 text-start transition ${sel === k.id ? "ring-2 ring-primary" : "hover:bg-muted"}`}>
          {k.logoAssetId ? <img src={fileUrl(k.logoAssetId)} alt="" className="h-9 w-9 rounded-lg object-contain" /> : <div className="flex h-9 w-9 overflow-hidden rounded-lg">{(k.colors as any[]).slice(0, 3).map((c, i) => <span key={i} className="flex-1" style={{ background: c.hex }} />)}</div>}
          <span className="flex-1 truncate text-sm font-medium">{k.name}</span>{k.isDefault && <Star className="h-4 w-4 fill-warning text-warning" />}
        </button>)}
      </div>
      {f && <Card className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-[120px_1fr]">
          <button onClick={() => setPick(true)} disabled={!can("brand.manage")} className="grid aspect-square place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-border hover:border-primary">
            {f.logoAssetId ? <img src={fileUrl(f.logoAssetId)} alt="" className="h-full w-full object-contain p-2" /> : <div className="text-center text-xs text-subtle"><ImagePlus className="mx-auto mb-1 h-6 w-6" />{t("الشعار", "Logo")}</div>}
          </button>
          <div className="space-y-3">
            <Field label={t("اسم العلامة *", "Brand name *")}><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label={t("وصف العلامة", "Description")}><textarea className="input min-h-[70px]" value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("الألوان الرسمية", "Brand colors")}</h3>
          <div className="flex flex-wrap gap-3">
            {f.colors.map((c: any, i: number) => <div key={i} className="flex items-center gap-2 rounded-xl border border-border p-2">
              <input type="color" value={c.hex} onChange={(e) => set("colors", f.colors.map((x: any, j: number) => (j === i ? { ...x, hex: e.target.value } : x)))} className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent" />
              <div><input className="w-24 bg-transparent text-sm outline-none" value={c.name} onChange={(e) => set("colors", f.colors.map((x: any, j: number) => (j === i ? { ...x, name: e.target.value } : x)))} /><div className="text-[11px] text-subtle" dir="ltr">{c.hex}</div></div>
              <button onClick={() => set("colors", f.colors.filter((_: any, j: number) => j !== i))} className="text-subtle hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>)}
            {f.colors.length < 12 && <button onClick={() => set("colors", [...f.colors, { name: "Color", hex: "#888888" }])} className="grid h-[58px] w-14 place-items-center rounded-xl border-2 border-dashed border-border text-subtle hover:border-primary"><Plus className="h-4 w-4" /></button>}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {f.fonts.map((fo: any, i: number) => <Field key={i} label={fo.role === "heading" ? t("خط العناوين", "Heading font") : t("خط النصوص", "Body font")}>
            <select className="input" value={fo.family} onChange={(e) => set("fonts", f.fonts.map((x: any, j: number) => (j === i ? { ...x, family: e.target.value } : x)))} style={{ fontFamily: fo.family }}>{FONTS.map((x) => <option key={x} style={{ fontFamily: x }}>{x}</option>)}</select></Field>)}
          <Field label={t("اللغة الافتراضية", "Default language")}><select className="input" value={f.language} onChange={(e) => set("language", e.target.value)}><option value="ar">العربية</option><option value="en">English</option></select></Field>
          <Field label={t("اللهجة", "Dialect")}><select className="input" value={f.dialect ?? "msa"} onChange={(e) => set("dialect", e.target.value)}>{DIALECTS.map(([v, a, e]) => <option key={v} value={v}>{t(a, e)}</option>)}</select></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("نبرة الكتابة", "Tone of voice")} hint={t("مثال: ودودة وواثقة، بدون مبالغة", "e.g. friendly and confident, no hype")}><textarea className="input min-h-[80px]" value={f.toneOfVoice ?? ""} onChange={(e) => set("toneOfVoice", e.target.value)} /></Field>
          <Field label={t("الجمهور المستهدف", "Target audience")}><textarea className="input min-h-[80px]" value={f.audience ?? ""} onChange={(e) => set("audience", e.target.value)} /></Field>
          <Field label={t("المنتجات", "Products")}><textarea className="input min-h-[80px]" value={f.products ?? ""} onChange={(e) => set("products", e.target.value)} /></Field>
          <Field label={t("الخدمات", "Services")}><textarea className="input min-h-[80px]" value={f.services ?? ""} onChange={(e) => set("services", e.target.value)} /></Field>
          <Field label={t("القيم", "Values")}><textarea className="input min-h-[80px]" value={f.values ?? ""} onChange={(e) => set("values", e.target.value)} /></Field>
          <Field label={t("الموقع الإلكتروني", "Website")}><input className="input" dir="ltr" value={f.website ?? ""} onChange={(e) => set("website", e.target.value)} /></Field>
          <Field label={t("هاشتاقات العلامة", "Brand hashtags")}><TagInput value={f.hashtags} onChange={(v) => set("hashtags", v)} prefix="#" placeholder="#..." /></Field>
          <Field label={t("كلمات ممنوعة", "Forbidden words")}><TagInput value={f.forbiddenWords} onChange={(v) => set("forbiddenWords", v)} /></Field>
        </div>
        {can("brand.manage") && <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button onClick={save} loading={busy} disabled={!f.name.trim()}><Save className="h-4 w-4" />{t("حفظ", "Save")}</Button>
          {sel !== "new" && !f.isDefault && <Button variant="outline" onClick={() => { set("isDefault", true); }}><Star className="h-4 w-4" />{t("تعيين كافتراضية", "Set default")}</Button>}
          {f.isDefault && <Badge tone="warning">{t("الهوية الافتراضية", "Default brand")}</Badge>}
          <div className="flex-1" />{sel !== "new" && <Button variant="ghost" className="text-danger" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" />{t("حذف", "Delete")}</Button>}
        </div>}
      </Card>}
    </div>}
    <MediaPicker open={pick} onClose={() => setPick(false)} kind="image" onPick={(a) => set("logoAssetId", a[0]?.id ?? null)} />
    <Confirm open={del} onClose={() => setDel(false)} onConfirm={remove} danger title={t("حذف العلامة؟", "Delete brand?")} />
  </div>;
}
