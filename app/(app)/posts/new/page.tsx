"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send } from "lucide-react";
import { Composer, type Draft } from "@/components/composer";
import { PageHeader, SkeletonList } from "@/components/ui";
import { useT } from "@/components/i18n";

function NewPost() {
  const t = useT(); const sp = useSearchParams();
  const [init, setInit] = useState<Draft | null>(null);
  useEffect(() => {
    let d: Draft = { title: "", body: "", status: "draft", contentType: null, campaignId: sp.get("campaignId"), ideaId: sp.get("ideaId"), media: [], variants: [] };
    try { const raw = sessionStorage.getItem("ss_draft"); if (raw && sp.get("from") === "studio") { d = { ...d, ...JSON.parse(raw) }; sessionStorage.removeItem("ss_draft"); } } catch { /* ignore */ }
    if (sp.get("date")) { const x = new Date(sp.get("date")!); x.setHours(19, 0, 0, 0); d.plannedAt = x.toISOString(); }
    setInit(d);
  }, [sp]);
  return <div><PageHeader icon={<Send />} title={t("منشور جديد", "New post")} subtitle={t("اختر المنصات، خصّص المحتوى لكل منصة، راجع ثم انشر أو جدول", "Pick platforms, tailor content, review, then publish or schedule")} />
    {init ? <Composer initial={init} /> : <SkeletonList />}</div>;
}
export default function Page() { return <Suspense><NewPost /></Suspense>; }
