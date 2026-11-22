"use client";
import { useRef, useState } from "react";
import { Upload, FileText, Music, Film, Check, Search } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/client";
import { useApi, useDebounced } from "./hooks";
import { useT } from "./i18n";
import { Modal, Button, Spinner, Tabs, useToast, EmptyState } from "./ui";

export type Asset = { id: string; name: string; kind: string; mimeType: string; sizeBytes: number; width?: number | null; height?: number | null; durationSec?: number | null; tags: string[]; platforms: string[]; createdAt: string; source: string; lastUsedAt?: string | null; _count?: { postMedia: number } };
export const fileUrl = (id: string) => `/api/media/${id}/file`;
export const fmtBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(2)} GB`);

export function AssetThumb({ a, className }: { a: Asset; className?: string }) {
  if (a.mimeType.startsWith("image/")) return <img src={fileUrl(a.id)} alt={a.name} loading="lazy" className={clsx("h-full w-full object-cover", className)} />;
  if (a.mimeType.startsWith("video/")) return <div className={clsx("relative h-full w-full bg-black", className)}><video src={fileUrl(a.id) + "#t=0.5"} preload="metadata" muted className="h-full w-full object-cover" /><Film className="absolute bottom-2 start-2 h-4 w-4 text-white drop-shadow" /></div>;
  const Icon = a.mimeType.startsWith("audio/") ? Music : FileText;
  return <div className={clsx("grid h-full w-full place-items-center bg-muted text-subtle", className)}><Icon className="h-8 w-8" /></div>;
}

export function Uploader({ onDone, accept, extra, compact }: { onDone: (items: Asset[]) => void; accept?: string; extra?: Record<string, string>; compact?: boolean }) {
  const t = useT(); const toast = useToast(); const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [drag, setDrag] = useState(false);
  async function upload(files: FileList | File[]) {
    const fd = new FormData(); Array.from(files).forEach((f) => fd.append("files", f));
    Object.entries(extra ?? {}).forEach(([k, v]) => fd.append(k, v));
    setBusy(true);
    try { const r = await api<{ items: Asset[]; errors: string[] }>("/api/media", { form: fd }); r.errors.forEach((e) => toast.error(e)); if (r.items.length) { toast.success(t(`تم رفع ${r.items.length} ملف`, `Uploaded ${r.items.length} file(s)`)); onDone(r.items); } }
    catch (e) { toast.error(e); } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }
  return <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}
    onClick={() => ref.current?.click()} className={clsx("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition", compact ? "p-4" : "p-8", drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50")}>
    <input ref={ref} type="file" multiple hidden accept={accept ?? "image/*,video/*,audio/*,application/pdf"} onChange={(e) => e.target.files && upload(e.target.files)} />
    {busy ? <Spinner className="h-6 w-6 text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
    <p className="mt-2 text-sm font-medium">{busy ? t("جاري الرفع...", "Uploading...") : t("اسحب الملفات هنا أو انقر للاختيار", "Drop files here or click to browse")}</p>
    {!compact && <p className="mt-1 text-xs text-subtle">PNG, JPG, WEBP, GIF, MP4, MOV, WEBM, MP3, WAV, PDF</p>}
  </div>;
}

export function MediaPicker({ open, onClose, onPick, multiple, kind }: { open: boolean; onClose: () => void; onPick: (a: Asset[]) => void; multiple?: boolean; kind?: string }) {
  const t = useT(); const [k, setK] = useState(kind ?? ""); const [q, setQ] = useState(""); const dq = useDebounced(q);
  const { data, loading, reload } = useApi<{ items: Asset[] }>(open ? `/api/media?kind=${k}&q=${encodeURIComponent(dq)}` : null);
  const [sel, setSel] = useState<Asset[]>([]);
  const toggle = (a: Asset) => setSel((s) => (s.some((x) => x.id === a.id) ? s.filter((x) => x.id !== a.id) : multiple ? [...s, a] : [a]));
  return <Modal open={open} onClose={onClose} size="xl" title={t("اختيار من مكتبة الملفات", "Pick from media library")}
    footer={<><Button variant="ghost" onClick={onClose}>{t("إلغاء", "Cancel")}</Button><Button disabled={!sel.length} onClick={() => { onPick(sel); setSel([]); onClose(); }}>{t("إضافة", "Add")} {sel.length > 0 && `(${sel.length})`}</Button></>}>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {!kind && <Tabs value={k} onChange={setK} items={[{ value: "", label: t("الكل", "All") }, { value: "image", label: t("صور", "Images") }, { value: "video", label: t("فيديو", "Video") }, { value: "audio", label: t("صوت", "Audio") }]} />}
      <div className="relative flex-1"><Search className="absolute start-3 top-2.5 h-4 w-4 text-subtle" /><input className="input ps-9" placeholder={t("بحث...", "Search...")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
    </div>
    <Uploader compact onDone={(items) => { reload(true); setSel(multiple ? [...sel, ...items] : items.slice(0, 1)); }} accept={kind ? `${kind}/*` : undefined} />
    {loading ? <div className="grid place-items-center py-10"><Spinner /></div> : !data?.items.length ? <div className="mt-4"><EmptyState icon={<FileText />} title={t("لا توجد ملفات", "No files")} /></div> :
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {data.items.map((a) => { const s = sel.some((x) => x.id === a.id); return (
          <button key={a.id} onClick={() => toggle(a)} className={clsx("group relative aspect-square overflow-hidden rounded-xl border-2 transition", s ? "border-primary ring-4 ring-primary/20" : "border-transparent hover:border-border")}>
            <AssetThumb a={a} />{s && <span className="absolute end-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-white"><Check className="h-3 w-3" /></span>}
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 px-1.5 pb-1 pt-4 text-[10px] text-white">{a.name}</span>
          </button>); })}
      </div>}
  </Modal>;
}
