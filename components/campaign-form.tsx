"use client";
import { useState } from "react";
import { useApi } from "./hooks";
import { useT } from "./i18n";
import { Field, Button } from "./ui";
import { PlatformIcon } from "./platform-icon";

export function CampaignForm({ initial, onSubmit, busy }: { initial?: any; onSubmit: (b: any) => void; busy?: boolean }) {
  const t = useT(); const { data: kits } = useApi<any[]>("/api/brand-kits");
  const [f, setF] = useState<any>({ name: "", goal: "", audience: "", startDate: "", endDate: "", platforms: [], budget: "", currency: "SAR", products: "", keyMessages: "", cta: "", visualIdentity: "", targetPostCount: "", brandKitId: "", ...(initial ?? {}),
    ...(initial?.startDate ? { startDate: initial.startDate.slice(0, 10) } : {}), ...(initial?.endDate ? { endDate: initial.endDate.slice(0, 10) } : {}) });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  function submit() {
    onSubmit({ name: f.name, goal: f.goal || null, audience: f.audience || null, startDate: f.startDate ? new Date(f.startDate).toISOString() : null, endDate: f.endDate ? new Date(f.endDate).toISOString() : null,
      platforms: f.platforms, budget: f.budget === "" || f.budget == null ? null : Number(f.budget), currency: f.currency, products: f.products || null, keyMessages: f.keyMessages || null, cta: f.cta || null,
      visualIdentity: f.visualIdentity || null, targetPostCount: f.targetPostCount ? Number(f.targetPostCount) : null, brandKitId: f.brandKitId || null });
  }
  return <div className="space-y-3">
    <div className="grid gap-3 md:grid-cols-2">
      <Field label={t("اسم الحملة *", "Campaign name *")} className="md:col-span-2"><input className="input" value={f.name} onChange={set("name")} /></Field>
      <Field label={t("الهدف", "Goal")}><textarea className="input min-h-[70px]" value={f.goal ?? ""} onChange={set("goal")} /></Field>
      <Field label={t("الجمهور", "Audience")}><textarea className="input min-h-[70px]" value={f.audience ?? ""} onChange={set("audience")} /></Field>
      <Field label={t("تاريخ البداية", "Start date")}><input type="date" className="input" value={f.startDate ?? ""} onChange={set("startDate")} /></Field>
      <Field label={t("تاريخ النهاية", "End date")}><input type="date" className="input" value={f.endDate ?? ""} onChange={set("endDate")} /></Field>
    </div>
    <Field label={t("المنصات", "Platforms")}><div className="flex flex-wrap gap-2">{["instagram", "x", "tiktok", "youtube", "snapchat", "gmail"].map((p) => { const on = f.platforms.includes(p); return <button type="button" key={p} onClick={() => setF({ ...f, platforms: on ? f.platforms.filter((x: string) => x !== p) : [...f.platforms, p] })} className={`rounded-xl border p-1.5 transition ${on ? "border-primary bg-primary/10" : "border-border opacity-50"}`}><PlatformIcon platform={p} size={26} /></button>; })}</div></Field>
    <div className="grid gap-3 md:grid-cols-3">
      <Field label={t("الميزانية (إعلانية)", "Budget (ads)")}><input type="number" min={0} className="input" value={f.budget ?? ""} onChange={set("budget")} /></Field>
      <Field label={t("العملة", "Currency")}><select className="input" value={f.currency} onChange={set("currency")}>{["SAR", "AED", "KWD", "QAR", "BHD", "OMR", "EGP", "JOD", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label={t("عدد المنشورات", "Number of posts")}><input type="number" min={1} max={200} className="input" value={f.targetPostCount ?? ""} onChange={set("targetPostCount")} /></Field>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <Field label={t("المنتجات", "Products")}><textarea className="input min-h-[70px]" value={f.products ?? ""} onChange={set("products")} /></Field>
      <Field label={t("الرسائل الرئيسية", "Key messages")}><textarea className="input min-h-[70px]" value={f.keyMessages ?? ""} onChange={set("keyMessages")} /></Field>
      <Field label="CTA"><input className="input" value={f.cta ?? ""} onChange={set("cta")} /></Field>
      <Field label={t("الهوية التجارية", "Brand kit")}><select className="input" value={f.brandKitId ?? ""} onChange={set("brandKitId")}><option value="">{t("الافتراضية", "Default")}</option>{kits?.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>
      <Field label={t("الهوية البصرية للحملة", "Visual identity")} className="md:col-span-2"><input className="input" value={f.visualIdentity ?? ""} onChange={set("visualIdentity")} /></Field>
    </div>
    <div className="flex justify-end"><Button onClick={submit} loading={busy} disabled={!f.name.trim()}>{t("حفظ", "Save")}</Button></div>
  </div>;
}
