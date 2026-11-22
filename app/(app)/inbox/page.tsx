"use client";
import { useState } from "react";
import Link from "next/link";
import { Inbox as InboxIcon, Sparkles, Send, RefreshCw, ListTodo, Check, X, Info } from "lucide-react";
import clsx from "clsx";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, Tabs, SkeletonList, EmptyState, ErrorBox, Button, Badge, useToast } from "@/components/ui";
import { PlatformIcon } from "@/components/platform-icon";
import { StatusBadge } from "@/components/status";
import { api } from "@/lib/client";

const CAT: Record<string, [string, string, "default" | "primary" | "success" | "warning" | "danger"]> = { question: ["سؤال", "Question", "primary"], complaint: ["شكوى", "Complaint", "danger"], praise: ["إشادة", "Praise", "success"], spam: ["مزعج", "Spam", "default"], lead: ["عميل محتمل", "Lead", "warning"], other: ["أخرى", "Other", "default"] };

export default function Inbox() {
  const t = useT(); const locale = useLocale(); const toast = useToast();
  const [status, setStatus] = useState("open"); const [category, setCategory] = useState("");
  const { data, loading, error, reload } = useApi<any>(`/api/inbox?status=${status}&category=${category}`);
  const [sel, setSel] = useState<any>(null); const [sugg, setSugg] = useState<any>(null); const [reply, setReply] = useState(""); const [busy, setBusy] = useState("");
  async function suggest() { setBusy("s"); try { const r = await api(`/api/inbox/${sel.id}/suggest`, { method: "POST" }); setSugg(r); setReply(r.replies[0] ?? ""); reload(true); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function send() { setBusy("r"); try { await api(`/api/inbox/${sel.id}/reply`, { body: { text: reply } }); toast.success(t("تم إرسال الرد عبر المنصة", "Reply sent via platform")); setSel(null); setSugg(null); setReply(""); reload(true); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function patch(b: any) { try { await api(`/api/inbox/${sel.id}`, { method: "PATCH", body: b }); setSel({ ...sel, ...b }); reload(true); } catch (e) { toast.error(e); } }
  async function task() { try { await api(`/api/inbox/${sel.id}/task`, { method: "POST" }); toast.success(t("تم تحويلها إلى مهمة", "Converted to task")); reload(true); } catch (e) { toast.error(e); } }
  async function sync() { try { const r = await api("/api/inbox/sync", { method: "POST" }); toast.info(t(`جاري المزامنة لـ ${r.queued} حساب`, `Syncing ${r.queued} accounts`)); setTimeout(() => reload(true), 8000); } catch (e) { toast.error(e); } }
  const channels = data?.channels ?? [];
  return <div>
    <PageHeader icon={<InboxIcon />} title={t("الرسائل والتعليقات", "Unified inbox")} subtitle={t("التعليقات من القنوات المدعومة فعليًا عبر API", "Comments from channels with real API support")} actions={<Button variant="outline" onClick={sync}><RefreshCw className="h-4 w-4" />{t("مزامنة", "Sync")}</Button>} />
    <Card className="mb-4 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Info className="h-4 w-4 text-primary" />{t("حالة القنوات", "Channel status")}</div>
      {channels.length === 0 ? <p className="text-sm text-subtle">{t("لا توجد حسابات مرتبطة. ", "No connected accounts. ")}<Link href="/accounts" className="text-primary">{t("اربط حسابًا", "Connect one")}</Link></p> :
        <div className="flex flex-wrap gap-2">{channels.map((ch: any) => <div key={ch.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs"><PlatformIcon platform={ch.platform} size={16} /><span>{ch.displayName}</span>
          <span className={clsx("flex items-center gap-0.5", ch.comments ? "text-success" : "text-subtle")}>{ch.comments ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{t("تعليقات", "comments")}</span>
          <span className={clsx("flex items-center gap-0.5", ch.messages ? "text-success" : "text-subtle")}>{ch.messages ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{t("رسائل", "DMs")}</span></div>)}</div>}
    </Card>
    <div className="mb-4 flex flex-wrap gap-2"><Tabs value={status} onChange={setStatus} items={[{ value: "open", label: t("مفتوحة", "Open") }, { value: "needs_follow_up", label: t("تحتاج متابعة", "Follow-up") }, { value: "replied", label: t("تم الرد", "Replied") }, { value: "closed", label: t("مغلقة", "Closed") }, { value: "", label: t("الكل", "All") }]} />
      <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">{t("كل التصنيفات", "All categories")}</option>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{t(v[0], v[1])}</option>)}</select></div>
    {error ? <ErrorBox error={error} onRetry={reload} /> : loading || !data ? <SkeletonList /> :
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Card className="divide-y divide-border">{data.items.length === 0 ? <div className="p-6"><EmptyState icon={<InboxIcon />} title={t("لا توجد عناصر", "Nothing here")} body={t("تُجلب التعليقات تلقائيًا من Instagram وYouTube للمنشورات المنشورة من المنصة.", "Comments are fetched from Instagram and YouTube for posts published from the platform.")} /></div> :
          data.items.map((c: any) => <button key={c.id} onClick={() => { setSel(c); setSugg(null); setReply(""); }} className={clsx("flex w-full gap-3 p-3 text-start transition hover:bg-muted/50", sel?.id === c.id && "bg-primary/5")}>
            <PlatformIcon platform={c.socialAccount.platform} size={22} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-sm"><b>{c.authorName}</b>{c.category && <Badge tone={CAT[c.category]?.[2]}>{t(CAT[c.category]?.[0] ?? c.category, CAT[c.category]?.[1] ?? c.category)}</Badge>}{c.priority === "high" && <Badge tone="danger">!</Badge>}<span className="ms-auto text-[11px] text-subtle">{new Date(c.postedAt).toLocaleString(locale)}</span></div>
              <p className="line-clamp-2 text-sm text-subtle">{c.text}</p></div></button>)}</Card>
        {sel ? <Card className="h-fit space-y-3 p-4 lg:sticky lg:top-20">
          <div className="flex items-center gap-2"><PlatformIcon platform={sel.socialAccount.platform} /><b>{sel.authorName}</b><StatusBadge status={sel.status} /></div>
          <p className="rounded-xl bg-muted/60 p-3 text-sm leading-7">{sel.text}</p>
          {sel.replyText && <p className="rounded-xl bg-success/10 p-3 text-sm">↩ {sel.replyText}</p>}
          <Button variant="outline" className="w-full" onClick={suggest} loading={busy === "s"}><Sparkles className="h-4 w-4" />{t("تصنيف واقتراح ردود", "Classify & suggest replies")}</Button>
          {sugg && <div className="space-y-1.5">{sugg.replies.map((r: string, i: number) => <button key={i} onClick={() => setReply(r)} className={clsx("w-full rounded-lg border p-2 text-start text-sm", reply === r ? "border-primary bg-primary/5" : "border-border")}>{r}</button>)}</div>}
          <textarea className="input min-h-[90px]" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t("اكتب ردك...", "Write your reply...")} />
          <div className="flex flex-wrap gap-2"><Button onClick={send} loading={busy === "r"} disabled={!reply.trim()}><Send className="h-4 w-4" />{t("إرسال الرد", "Send reply")}</Button><Button variant="outline" onClick={task}><ListTodo className="h-4 w-4" />{t("مهمة", "Task")}</Button>
            <select className="input w-auto" value={sel.status} onChange={(e) => patch({ status: e.target.value })}>{[["open", "مفتوح", "Open"], ["needs_follow_up", "يحتاج متابعة", "Follow-up"], ["replied", "تم الرد", "Replied"], ["closed", "مغلق", "Closed"]].map(([v, a, e]) => <option key={v} value={v}>{t(a, e)}</option>)}</select></div>
        </Card> : <Card className="hidden h-60 place-items-center text-sm text-subtle lg:grid">{t("اختر عنصرًا", "Select an item")}</Card>}
      </div>}
  </div>;
}
