"use client";
import Link from "next/link";
import { Palette, Plus, Trash2, Copy } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, SkeletonList, EmptyState, ErrorBox, useToast } from "@/components/ui";
import { fileUrl } from "@/components/media";
import { SIZE_PRESETS } from "@/lib/platforms";
import { api } from "@/lib/client";

export default function Designs() {
  const t = useT(); const locale = useLocale(); const toast = useToast();
  const { data, loading, error, reload } = useApi<any[]>("/api/designs");
  return <div>
    <PageHeader icon={<Palette />} title={t("استوديو التصميم بالذكاء الاصطناعي", "AI Design Studio")} subtitle={t("صمم إعلانات ومنشورات وستوريز وصورًا مصغرة بمقاسات كل منصة", "Design ads, posts, stories and thumbnails in every platform's size")}
      actions={<Link href="/design/new" className="btn-primary"><Plus className="h-4 w-4" />{t("تصميم جديد", "New design")}</Link>} />
    {error ? <ErrorBox error={error} onRetry={reload} /> : loading || !data ? <SkeletonList /> : data.length === 0 ?
      <EmptyState icon={<Palette />} title={t("لا توجد تصاميم بعد", "No designs yet")} body={t("اكتب وصفًا مثل: صمم إعلانًا احترافيًا عن خصم 20% على المنتجات", "Describe it, e.g. a professional ad for 20% off all products")} action={<Link href="/design/new" className="btn-primary">{t("ابدأ التصميم", "Start designing")}</Link>} /> :
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">{data.map((d) => <Card key={d.id} className="group overflow-hidden">
        <Link href={`/design/${d.id}`} className="block"><div className="grid aspect-square place-items-center bg-muted p-3">{d.thumbnailAssetId ? <img src={fileUrl(d.thumbnailAssetId)} alt="" className="max-h-full max-w-full rounded shadow" /> : <div className="rounded bg-surface shadow" style={{ aspectRatio: `${d.width}/${d.height}`, width: d.width >= d.height ? "90%" : "auto", height: d.height > d.width ? "90%" : "auto" }} />}</div></Link>
        <div className="flex items-center gap-1 p-2.5"><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{d.name}</div><div className="text-[11px] text-subtle">{t(SIZE_PRESETS[d.preset as keyof typeof SIZE_PRESETS]?.nameAr ?? d.preset, SIZE_PRESETS[d.preset as keyof typeof SIZE_PRESETS]?.name ?? d.preset)} · {new Date(d.updatedAt).toLocaleDateString(locale)}</div></div>
          <button className="btn-ghost h-7 w-7 p-0 opacity-0 group-hover:opacity-100" onClick={async () => { await api(`/api/designs/${d.id}`, { method: "POST" }); reload(true); }}><Copy className="h-3.5 w-3.5" /></button>
          <button className="btn-ghost h-7 w-7 p-0 text-danger opacity-0 group-hover:opacity-100" onClick={async () => { try { await api(`/api/designs/${d.id}`, { method: "DELETE" }); reload(true); } catch (e) { toast.error(e); } }}><Trash2 className="h-3.5 w-3.5" /></button></div>
      </Card>)}</div>}
  </div>;
}
