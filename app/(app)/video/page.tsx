"use client";
import Link from "next/link";
import { Clapperboard, Plus, Scissors, Trash2 } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, SkeletonList, EmptyState, ErrorBox, Badge } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { fileUrl } from "@/components/media";
import { api } from "@/lib/client";

export default function Videos() {
  const t = useT(); const locale = useLocale();
  const { data, loading, error, reload } = useApi<any[]>("/api/videos");
  return <div>
    <PageHeader icon={<Clapperboard />} title={t("استوديو الفيديو", "AI Video Studio")} subtitle={t("من فكرة إلى فيديو جاهز: سيناريو، مشاهد، صور، تعليق صوتي، ترجمة وإخراج", "From idea to finished video: script, scenes, images, voice-over, captions, render")}
      actions={<><Link href="/video/clips" className="btn-outline"><Scissors className="h-4 w-4" />{t("فيديو طويل ← مقاطع قصيرة", "Long → short clips")}</Link><Link href="/video/new" className="btn-primary"><Plus className="h-4 w-4" />{t("فيديو جديد", "New video")}</Link></>} />
    {error ? <ErrorBox error={error} onRetry={reload} /> : loading || !data ? <SkeletonList /> : data.length === 0 ?
      <EmptyState icon={<Clapperboard />} title={t("لا توجد مشاريع فيديو", "No video projects")} action={<Link href="/video/new" className="btn-primary">{t("أنشئ أول فيديو", "Create your first video")}</Link>} /> :
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{data.map((v) => <Card key={v.id} className="group overflow-hidden">
        <Link href={`/video/${v.id}`}><div className="grid aspect-video place-items-center bg-gradient-to-br from-slate-900 to-primary/60 text-white">{v.outputAssetId ? <video src={fileUrl(v.outputAssetId) + "#t=1"} preload="metadata" muted className="h-full w-full object-contain" /> : <Clapperboard className="h-8 w-8 opacity-60" />}</div></Link>
        <div className="p-3"><div className="flex items-start gap-2"><Link href={`/video/${v.id}`} className="flex-1 truncate font-medium">{v.title}</Link><button className="opacity-0 group-hover:opacity-100" onClick={async () => { await api(`/api/videos/${v.id}`, { method: "DELETE" }); reload(true); }}><Trash2 className="h-4 w-4 text-danger" /></button></div>
          <div className="mt-2 flex items-center gap-2 text-xs text-subtle"><StatusBadge status={v.status} /><Badge>{v.aspectRatio}</Badge><span>{v._count.scenes} {t("مشهد", "scenes")}</span><span className="ms-auto">{new Date(v.updatedAt).toLocaleDateString(locale)}</span></div></div>
      </Card>)}</div>}
  </div>;
}
