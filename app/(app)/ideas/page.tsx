"use client";
import Link from "next/link";
import { useState } from "react";
import { Lightbulb, Plus, Sparkles, Trash2, Wand2, Search } from "lucide-react";
import { useApi, useDebounced } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, Tabs, SkeletonList, ErrorBox, EmptyState, Modal, Button, Field, Badge, useToast } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { usePerms } from "@/components/shell";
import { api } from "@/lib/client";

export default function Ideas() {
  const t = useT(); const locale = useLocale(); const toast = useToast(); const can = usePerms();
  const [status, setStatus] = useState(""); const [q, setQ] = useState(""); const dq = useDebounced(q);
  const { data, loading, error, reload } = useApi<any[]>(`/api/ideas?status=${status}&q=${encodeURIComponent(dq)}`);
  const [add, setAdd] = useState(false); const [ai, setAi] = useState(false);
  const [f, setF] = useState({ title: "", body: "" }); const [topic, setTopic] = useState(""); const [count, setCount] = useState(10); const [busy, setBusy] = useState(false);
  async function create() { setBusy(true); try { await api("/api/ideas", { body: f }); setAdd(false); setF({ title: "", body: "" }); reload(true); } catch (e) { toast.error(e); } finally { setBusy(false); } }
  async function gen() { setBusy(true); try { const r = await api("/api/ai/ideas", { body: { topic, count } }); toast.success(t(`أُضيفت ${r.ideas.length} فكرة`, `${r.ideas.length} ideas added`)); setAi(false); reload(true); } catch (e) { toast.error(e); } finally { setBusy(false); } }
  async function patch(id: string, b: any) { try { await api(`/api/ideas/${id}`, { method: "PATCH", body: b }); reload(true); } catch (e) { toast.error(e); } }
  async function remove(id: string) { try { await api(`/api/ideas/${id}`, { method: "DELETE" }); reload(true); } catch (e) { toast.error(e); } }
  return <div>
    <PageHeader icon={<Lightbulb />} title={t("بنك الأفكار", "Ideas bank")} subtitle={t("اجمع أفكارك وحوّلها إلى محتوى بنقرة", "Collect ideas and turn them into content in one click")}
      actions={can("content.create") && <><Button variant="outline" onClick={() => setAi(true)}><Sparkles className="h-4 w-4" />{t("اقتراح أفكار بالذكاء الاصطناعي", "AI ideas")}</Button><Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" />{t("فكرة", "Idea")}</Button></>} />
    <div className="mb-4 flex flex-wrap gap-2"><Tabs value={status} onChange={setStatus} items={[{ value: "", label: t("الكل", "All") }, { value: "new", label: t("جديدة", "New") }, { value: "in_progress", label: t("قيد العمل", "In progress") }, { value: "used", label: t("مستخدمة", "Used") }, { value: "archived", label: t("مؤرشفة", "Archived") }]} />
      <div className="relative min-w-[200px] flex-1"><Search className="absolute start-3 top-2.5 h-4 w-4 text-subtle" /><input className="input ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("بحث...", "Search...")} /></div></div>
    {error ? <ErrorBox error={error} onRetry={reload} /> : loading || !data ? <SkeletonList /> : data.length === 0 ? <EmptyState icon={<Lightbulb />} title={t("لا توجد أفكار", "No ideas yet")} /> :
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.map((i) => <Card key={i.id} className="flex flex-col p-4">
        <div className="flex items-start gap-2"><h3 className="flex-1 font-medium leading-7">{i.title}</h3><StatusBadge status={i.status} /></div>
        {i.body && <p className="mt-1 line-clamp-4 flex-1 text-sm leading-6 text-subtle">{i.body}</p>}
        <div className="mt-2 flex flex-wrap gap-1">{i.tags.map((x: string) => <Badge key={x}>{x}</Badge>)}{i.campaign && <Badge tone="primary">{i.campaign.name}</Badge>}{i.generated && <Badge tone="success">{t("حزمة جاهزة", "Pack ready")}</Badge>}</div>
        <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
          <Link href={i.generated ? `/studio?ideaId=${i.id}` : `/studio?idea=${encodeURIComponent(i.body || i.title)}`} className="btn-primary h-8 px-3 text-xs"><Wand2 className="h-3.5 w-3.5" />{t("حوّلها لمحتوى", "Make content")}</Link>
          <select className="input h-8 w-auto py-0 text-xs" value={i.status} onChange={(e) => patch(i.id, { status: e.target.value })}>{[["new", "جديدة", "New"], ["in_progress", "قيد العمل", "In progress"], ["used", "مستخدمة", "Used"], ["archived", "مؤرشفة", "Archived"]].map(([v, a, e]) => <option key={v} value={v}>{t(a, e)}</option>)}</select>
          <span className="flex-1 text-end text-[11px] text-subtle">{new Date(i.createdAt).toLocaleDateString(locale)}</span>
          {can("content.delete") && <button className="btn-ghost h-8 w-8 p-0 text-danger" onClick={() => remove(i.id)}><Trash2 className="h-3.5 w-3.5" /></button>}
        </div>
      </Card>)}</div>}
    <Modal open={add} onClose={() => setAdd(false)} title={t("فكرة جديدة", "New idea")} footer={<Button onClick={create} loading={busy} disabled={!f.title.trim()}>{t("حفظ", "Save")}</Button>}>
      <div className="space-y-3"><Field label={t("العنوان", "Title")}><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field><Field label={t("التفاصيل", "Details")}><textarea className="input min-h-[120px]" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field></div>
    </Modal>
    <Modal open={ai} onClose={() => setAi(false)} title={t("اقتراح أفكار", "Suggest ideas")} footer={<Button onClick={gen} loading={busy} disabled={topic.trim().length < 2}><Sparkles className="h-4 w-4" />{t("اقترح", "Suggest")}</Button>}>
      <div className="space-y-3"><Field label={t("الموضوع", "Topic")} hint={t("مثال: أفكار فيديو لهذا الأسبوع عن منتجات العناية بالبشرة", "e.g. video ideas this week about skincare products")}><textarea className="input min-h-[90px]" value={topic} onChange={(e) => setTopic(e.target.value)} /></Field>
        <Field label={t("العدد", "Count")}><input type="number" min={1} max={30} className="input" value={count} onChange={(e) => setCount(Number(e.target.value))} /></Field></div>
    </Modal>
  </div>;
}
