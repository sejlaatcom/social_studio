"use client";
import { useState } from "react";
import Link from "next/link";
import { FolderOpen, Search, Download, Copy, Trash2, HardDrive, Save } from "lucide-react";
import { useApi, useDebounced } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, Tabs, SkeletonList, ErrorBox, EmptyState, Modal, Button, Field, Badge, Confirm, useToast } from "@/components/ui";
import { AssetThumb, Uploader, fileUrl, fmtBytes, type Asset } from "@/components/media";
import { PlatformIcon } from "@/components/platform-icon";
import { StatusBadge } from "@/components/status";
import { usePerms } from "@/components/shell";
import { api } from "@/lib/client";

const PLATFORMS = ["instagram", "x", "tiktok", "youtube", "snapchat", "gmail"];

export default function Media() {
  const t = useT(); const locale = useLocale(); const toast = useToast(); const can = usePerms();
  const [kind, setKind] = useState(""); const [q, setQ] = useState(""); const [tag, setTag] = useState(""); const [platform, setPlatform] = useState("");
  const dq = useDebounced(q);
  const { data, loading, error, reload } = useApi<any>(`/api/media?kind=${kind}&q=${encodeURIComponent(dq)}&tag=${encodeURIComponent(tag)}&platform=${platform}`);
  const [open, setOpen] = useState<string | null>(null);
  const used = data?.storage.usedBytes ?? 0; const limit = data?.storage.limitMb ? data.storage.limitMb * 1048576 : null;

  return <div>
    <PageHeader icon={<FolderOpen />} title={t("مكتبة الملفات", "Media library")} subtitle={t("كل الصور والفيديوهات والتصاميم والملفات الصوتية في مكان واحد", "All your images, videos, designs and audio in one place")} />
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={kind} onChange={setKind} items={[{ value: "", label: t("الكل", "All") }, { value: "image", label: t("صور", "Images") }, { value: "video", label: t("فيديو", "Videos") }, { value: "design", label: t("تصاميم", "Designs") }, { value: "audio", label: t("صوت", "Audio") }, { value: "logo", label: t("شعارات", "Logos") }, { value: "pdf", label: "PDF" }]} />
          <div className="relative min-w-[200px] flex-1"><Search className="absolute start-3 top-2.5 h-4 w-4 text-subtle" /><input className="input ps-9" placeholder={t("ابحث بالاسم أو الوسم...", "Search by name or tag...")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input w-auto" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">{t("كل المنصات", "All platforms")}</option>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          {data?.tags?.length > 0 && <select className="input w-auto" value={tag} onChange={(e) => setTag(e.target.value)}><option value="">{t("كل الوسوم", "All tags")}</option>{data.tags.map((x: string) => <option key={x}>{x}</option>)}</select>}
        </div>
        {error ? <ErrorBox error={error} onRetry={reload} /> : loading || !data ? <SkeletonList /> : data.items.length === 0 ?
          <EmptyState icon={<FolderOpen />} title={t("لا توجد ملفات", "No files yet")} body={t("ارفع ملفاتك أو أنشئ تصاميم وفيديوهات لتظهر هنا.", "Upload files or create designs and videos.")} /> :
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {data.items.map((a: any) => <button key={a.id} onClick={() => setOpen(a.id)} className="card group overflow-hidden text-start transition hover:-translate-y-0.5 hover:shadow-pop">
              <div className="aspect-square overflow-hidden"><AssetThumb a={a} className="transition duration-300 group-hover:scale-105" /></div>
              <div className="p-2.5"><div className="truncate text-xs font-medium">{a.name}</div><div className="mt-0.5 flex items-center justify-between text-[11px] text-subtle"><span>{fmtBytes(a.sizeBytes)}</span>{a._count.postMedia > 0 && <span>{a._count.postMedia} {t("منشور", "posts")}</span>}</div></div>
            </button>)}
          </div>}
      </div>
      <div className="space-y-4">
        {can("media.manage") && <Uploader onDone={() => reload(true)} />}
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><HardDrive className="h-4 w-4 text-primary" />{t("مساحة التخزين", "Storage")}</div>
          <div className="text-2xl font-bold">{fmtBytes(used)}</div>
          {limit && <><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} /></div><div className="mt-1 text-xs text-subtle">{t("من", "of")} {fmtBytes(limit)} · {data?.total ?? 0} {t("ملف", "files")}</div></>}
        </Card>
      </div>
    </div>
    {open && <AssetModal id={open} onClose={() => setOpen(null)} onChanged={() => reload(true)} locale={locale} />}
  </div>;
}

function AssetModal({ id, onClose, onChanged, locale }: { id: string; onClose: () => void; onChanged: () => void; locale: string }) {
  const t = useT(); const toast = useToast(); const can = usePerms();
  const { data, loading } = useApi<any>(`/api/media/${id}`);
  const [form, setForm] = useState<any>(null); const [busy, setBusy] = useState(""); const [del, setDel] = useState(false);
  const f = form ?? (data && { name: data.name, tags: data.tags.join(", "), platforms: data.platforms, kind: data.kind });
  async function save() { setBusy("save"); try { await api(`/api/media/${id}`, { method: "PATCH", body: { name: f.name, kind: f.kind, platforms: f.platforms, tags: f.tags.split(",").map((s: string) => s.trim()).filter(Boolean) } }); toast.success(t("تم الحفظ", "Saved")); onChanged(); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function dup() { setBusy("dup"); try { await api(`/api/media/${id}/duplicate`, { method: "POST" }); toast.success(t("تم إنشاء نسخة", "Duplicated")); onChanged(); onClose(); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function remove() { setBusy("del"); try { await api(`/api/media/${id}?force=1`, { method: "DELETE" }); toast.success(t("تم الحذف", "Deleted")); onChanged(); onClose(); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  return <Modal open onClose={onClose} size="lg" title={data?.name ?? "..."}>
    {loading || !data ? <SkeletonList rows={2} /> : <div className="grid gap-5 md:grid-cols-2">
      <div>
        <div className="overflow-hidden rounded-xl bg-muted">{data.mimeType.startsWith("video/") ? <video src={fileUrl(id)} controls className="max-h-80 w-full" /> : data.mimeType.startsWith("audio/") ? <audio src={fileUrl(id)} controls className="w-full p-4" /> : data.mimeType === "application/pdf" ? <iframe src={fileUrl(id)} className="h-80 w-full" sandbox="" /> : <img src={fileUrl(id)} alt="" className="max-h-80 w-full object-contain" />}</div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div><dt className="text-subtle">{t("الحجم", "Size")}</dt><dd>{fmtBytes(data.sizeBytes)}</dd></div>
          <div><dt className="text-subtle">{t("الأبعاد", "Dimensions")}</dt><dd dir="ltr">{data.width ? `${data.width}×${data.height}` : "—"}{data.durationSec ? ` · ${data.durationSec.toFixed(1)}s` : ""}</dd></div>
          <div><dt className="text-subtle">{t("المصدر", "Source")}</dt><dd>{data.source}</dd></div>
          <div><dt className="text-subtle">{t("آخر استخدام", "Last used")}</dt><dd>{data.lastUsedAt ? new Date(data.lastUsedAt).toLocaleString(locale) : "—"}</dd></div>
          <div><dt className="text-subtle">{t("تاريخ الرفع", "Uploaded")}</dt><dd>{new Date(data.createdAt).toLocaleString(locale)}</dd></div>
          {data.campaign && <div><dt className="text-subtle">{t("الحملة", "Campaign")}</dt><dd>{data.campaign.name}</dd></div>}
        </dl>
        <h4 className="mb-2 mt-4 text-sm font-semibold">{t("المنشورات المرتبطة", "Linked posts")}</h4>
        {data.postMedia.length === 0 ? <p className="text-xs text-subtle">{t("غير مستخدم في أي منشور", "Not used in any post")}</p> : <div className="space-y-1">{data.postMedia.map((pm: any) => <Link key={pm.id} href={`/posts/${pm.post.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-muted"><span className="truncate">{pm.post.title}</span><StatusBadge status={pm.post.status} /></Link>)}</div>}
      </div>
      <div className="space-y-3">
        <Field label={t("الاسم", "Name")}><input className="input" value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} disabled={!can("media.manage")} /></Field>
        <Field label={t("النوع", "Type")}><select className="input" value={f.kind} onChange={(e) => setForm({ ...f, kind: e.target.value })}>{["image", "video", "audio", "design", "logo", "template", "pdf", "other"].map((k) => <option key={k}>{k}</option>)}</select></Field>
        <Field label={t("الوسوم (مفصولة بفاصلة)", "Tags (comma separated)")}><input className="input" value={f.tags} onChange={(e) => setForm({ ...f, tags: e.target.value })} /></Field>
        <Field label={t("المنصات", "Platforms")}><div className="flex flex-wrap gap-2">{PLATFORMS.map((p) => { const on = f.platforms.includes(p); return <button key={p} onClick={() => setForm({ ...f, platforms: on ? f.platforms.filter((x: string) => x !== p) : [...f.platforms, p] })} className={`rounded-lg border p-1 ${on ? "border-primary bg-primary/10" : "border-border opacity-60"}`}><PlatformIcon platform={p} size={22} /></button>; })}</div></Field>
        <div className="flex flex-wrap gap-2 pt-2">
          {can("media.manage") && <Button onClick={save} loading={busy === "save"}><Save className="h-4 w-4" />{t("حفظ", "Save")}</Button>}
          <a href={fileUrl(id) + "?download=1"} className="btn-outline"><Download className="h-4 w-4" />{t("تحميل", "Download")}</a>
          {can("media.manage") && <Button variant="outline" onClick={dup} loading={busy === "dup"}><Copy className="h-4 w-4" />{t("نسخ", "Duplicate")}</Button>}
          {can("media.manage") && <Button variant="ghost" className="text-danger" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" /></Button>}
        </div>
        {data.tags.length > 0 && <div className="flex flex-wrap gap-1">{data.tags.map((x: string) => <Badge key={x}>#{x}</Badge>)}</div>}
      </div>
    </div>}
    <Confirm open={del} onClose={() => setDel(false)} onConfirm={remove} loading={busy === "del"} danger title={t("حذف الملف؟", "Delete file?")} body={data?.postMedia?.length ? t(`الملف مستخدم في ${data.postMedia.length} منشور وسيُزال منها.`, `Used in ${data.postMedia.length} posts; it will be removed from them.`) : t("لا يمكن التراجع عن هذا الإجراء.", "This cannot be undone.")} />
  </Modal>;
}
