"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Plus, Send, Users, Upload, Sparkles, Trash2, Eye, CalendarDays, FileText } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, Tabs, SkeletonList, EmptyState, Button, Field, Modal, Badge, Toggle, useToast } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { MediaPicker } from "@/components/media";
import { renderEmailHtml } from "@/lib/email-render";
import { api } from "@/lib/client";

function EmailPage() {
  const t = useT(); const sp = useSearchParams();
  const [tab, setTab] = useState(sp.get("subject") ? "compose" : "campaigns");
  return <div>
    <PageHeader icon={<Mail />} title={t("الحملات البريدية (Gmail)", "Email campaigns (Gmail)")} subtitle={t("رسائل ونشرات تسويقية عبر Gmail API مع احترام حدود الإرسال وإلغاء الاشتراك", "Marketing emails via Gmail API, respecting send limits and unsubscribes")} />
    <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: "campaigns", label: t("الحملات", "Campaigns") }, { value: "compose", label: t("إنشاء رسالة", "Compose") }, { value: "contacts", label: t("جهات الاتصال والمجموعات", "Contacts & groups") }]} />
    {tab === "campaigns" ? <Campaigns onNew={() => setTab("compose")} /> : tab === "compose" ? <Compose onDone={() => setTab("campaigns")} /> : <Contacts />}
  </div>;
}

function Campaigns({ onNew }: { onNew: () => void }) {
  const t = useT(); const locale = useLocale(); const toast = useToast();
  const { data, loading, reload } = useApi<any[]>("/api/email/campaigns");
  const [preview, setPreview] = useState<any>(null);
  async function act(id: string, mode: string, at?: string) { try { const r = await api(`/api/email/campaigns/${id}/send`, { body: { mode, at } }); toast.success(mode === "cancel" ? t("أُلغيت الجدولة", "Unscheduled") : t(`سيُرسل إلى ${r.recipients} مستلم`, `Sending to ${r.recipients} recipients`)); reload(true); } catch (e) { toast.error(e); } }
  if (loading || !data) return <SkeletonList />;
  if (!data.length) return <EmptyState icon={<Mail />} title={t("لا توجد حملات بريدية", "No email campaigns")} action={<Button onClick={onNew}><Plus className="h-4 w-4" />{t("أنشئ رسالة", "Compose")}</Button>} />;
  return <Card className="divide-y divide-border">{data.map((e) => <div key={e.id} className="flex flex-wrap items-center gap-3 p-3">
    <div className="min-w-0 flex-1"><div className="font-medium">{e.name}</div><div className="truncate text-xs text-subtle">{e.subject} · {e.group ? `${e.group.name} (${e.group._count.members})` : t("بدون مجموعة", "no group")}</div></div>
    {(e.sentCount > 0 || e.failedCount > 0) && <span className="text-xs text-subtle">✓ {e.sentCount} · ✗ {e.failedCount}</span>}
    {e.scheduledAt && e.status === "scheduled" && <span className="text-xs text-subtle">{new Date(e.scheduledAt).toLocaleString(locale)}</span>}
    <StatusBadge status={e.status} />
    <Button variant="ghost" className="h-8 px-2" onClick={() => setPreview(e)}><Eye className="h-4 w-4" /></Button>
    {e.status === "draft" && <Button className="h-8" onClick={() => act(e.id, "now")}><Send className="h-4 w-4" />{t("إرسال", "Send")}</Button>}
    {e.status === "scheduled" && <Button variant="outline" className="h-8" onClick={() => act(e.id, "cancel")}>{t("إلغاء", "Cancel")}</Button>}
    {!["sending"].includes(e.status) && <button className="btn-ghost h-8 w-8 p-0 text-danger" onClick={async () => { await api(`/api/email/campaigns/${e.id}`, { method: "DELETE" }); reload(true); }}><Trash2 className="h-4 w-4" /></button>}
    {e.lastError && <p className="w-full text-xs text-danger">{e.lastError}</p>}
  </div>)}
    {preview && <Modal open onClose={() => setPreview(null)} size="lg" title={preview.subject}><iframe sandbox="" srcDoc={preview.html} className="h-[600px] w-full rounded-lg border border-border bg-white" /></Modal>}
  </Card>;
}

function Compose({ onDone }: { onDone: () => void }) {
  const t = useT(); const toast = useToast(); const sp = useSearchParams(); const locale = useLocale();
  const { data: acc } = useApi<any>("/api/accounts"); const { data: groups } = useApi<any[]>("/api/email/groups");
  const gmail = (acc?.accounts ?? []).filter((a: any) => a.platform === "gmail");
  const [f, setF] = useState({ name: sp.get("subject") ?? "", subject: sp.get("subject") ?? "", preheader: "", headline: sp.get("headline") ?? "", body: sp.get("body") ?? "", ctaLabel: sp.get("cta") ?? "", ctaUrl: "", footer: "", imageUrl: "", color: "#6d5dfc", dir: locale === "ar" ? "rtl" : "ltr", socialAccountId: "", groupId: "" });
  const [ai, setAi] = useState({ goal: "", kind: "newsletter" }); const [busy, setBusy] = useState(""); const [sched, setSched] = useState(""); const [testTo, setTestTo] = useState("");
  useEffect(() => { if (gmail[0] && !f.socialAccountId) setF((x) => ({ ...x, socialAccountId: gmail[0].id })); }, [gmail, f.socialAccountId]);
  const html = useMemo(() => renderEmailHtml({ preheader: f.preheader, headline: f.headline, paragraphs: f.body.split(/\n{2,}/).filter(Boolean), ctaLabel: f.ctaLabel, ctaUrl: f.ctaUrl, imageUrl: f.imageUrl || undefined, footer: f.footer, color: f.color, dir: f.dir as "rtl" | "ltr" }), [f]);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  async function gen() { setBusy("ai"); try { const r = await api("/api/ai/email", { body: { goal: ai.goal, kind: ai.kind, language: f.dir === "rtl" ? "ar" : "en" } }); setF({ ...f, subject: r.subject, name: f.name || r.subject, preheader: r.preheader, headline: r.headline, body: r.paragraphs.join("\n\n"), ctaLabel: r.ctaLabel, footer: r.footer }); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function save(): Promise<string | null> { try { const e = await api("/api/email/campaigns", { body: { name: f.name || f.subject, subject: f.subject, html, socialAccountId: f.socialAccountId || null, groupId: f.groupId || null } }); return e.id; } catch (e) { toast.error(e); return null; } }
  async function test(draft: boolean) { setBusy(draft ? "draft" : "test"); const id = await save(); if (!id) { setBusy(""); return; } try { await api(`/api/email/campaigns/${id}/test`, { body: { to: testTo || undefined, draft } }); toast.success(draft ? t("حُفظت كمسودة في Gmail", "Saved as Gmail draft") : t("أُرسلت رسالة تجريبية", "Test sent")); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function send(mode: "now" | "schedule") { setBusy(mode); const id = await save(); if (!id) { setBusy(""); return; } try { const r = await api(`/api/email/campaigns/${id}/send`, { body: { mode, at: mode === "schedule" ? new Date(sched).toISOString() : undefined } }); toast.success(t(`تمت الجدولة لـ ${r.recipients} مستلم`, `Queued for ${r.recipients} recipients`)); onDone(); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function draftOnly() { setBusy("save"); if (await save()) { toast.success(t("حُفظت الحملة", "Campaign saved")); onDone(); } setBusy(""); }
  return <div className="grid gap-4 xl:grid-cols-2">
    <div className="space-y-4">
      <Card className="space-y-2 bg-gradient-to-br from-primary/10 to-transparent p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />{t("اكتب بالذكاء الاصطناعي", "Write with AI")}</div>
        <div className="flex flex-wrap gap-2"><select className="input w-auto" value={ai.kind} onChange={(e) => setAi({ ...ai, kind: e.target.value })}>{[["newsletter", "نشرة بريدية", "Newsletter"], ["promotion", "عرض ترويجي", "Promotion"], ["welcome", "رسالة ترحيبية", "Welcome"], ["follow_up", "رسالة متابعة", "Follow-up"], ["announcement", "إعلان", "Announcement"]].map(([v, a, e]) => <option key={v} value={v}>{t(a, e)}</option>)}</select>
          <input className="input flex-1" placeholder={t("الهدف: مثال — الإعلان عن تخفيضات نهاية الموسم", "Goal: e.g. announce end-of-season sale")} value={ai.goal} onChange={(e) => setAi({ ...ai, goal: e.target.value })} /><Button onClick={gen} loading={busy === "ai"} disabled={ai.goal.length < 3}>{t("اكتب", "Write")}</Button></div></Card>
      <Card className="space-y-3 p-5">
        <div className="grid gap-3 md:grid-cols-2"><Field label={t("اسم الحملة", "Campaign name")}><input className="input" value={f.name} onChange={set("name")} /></Field><Field label={t("الموضوع (Subject)", "Subject")} hint={`${f.subject.length}/60`}><input className="input" value={f.subject} onChange={set("subject")} /></Field></div>
        <Field label="Preheader"><input className="input" value={f.preheader} onChange={set("preheader")} /></Field>
        <Field label={t("العنوان الرئيسي", "Headline")}><input className="input" value={f.headline} onChange={set("headline")} /></Field>
        <Field label={t("النص (افصل الفقرات بسطر فارغ) — يدعم {{name}}", "Body (blank line between paragraphs) — supports {{name}}")}><textarea className="input min-h-[160px] leading-7" value={f.body} onChange={set("body")} /></Field>
        <div className="grid gap-3 md:grid-cols-2"><Field label={t("نص الزر (CTA)", "CTA label")}><input className="input" value={f.ctaLabel} onChange={set("ctaLabel")} /></Field><Field label={t("رابط الزر", "CTA URL")}><input className="input" dir="ltr" value={f.ctaUrl} onChange={set("ctaUrl")} placeholder="https://" /></Field>
          <Field label={t("رابط صورة البانر (عام)", "Banner image URL (public)")} hint={t("يجب أن يكون الرابط عامًا ليظهر في بريد المستلم", "Must be publicly reachable for recipients")}><input className="input" dir="ltr" value={f.imageUrl} onChange={set("imageUrl")} placeholder="https://" /></Field>
          <Field label={t("لون الزر", "Button color")}><input type="color" className="h-10 w-full rounded-lg" value={f.color} onChange={set("color")} /></Field>
          <Field label={t("التذييل (العنوان، معلومات الشركة)", "Footer (address, company info)")} className="md:col-span-2"><input className="input" value={f.footer} onChange={set("footer")} /></Field></div>
        <Toggle checked={f.dir === "rtl"} onChange={(v) => setF({ ...f, dir: v ? "rtl" : "ltr" })} label={t("اتجاه من اليمين لليسار", "Right-to-left")} />
      </Card>
      <Card className="space-y-3 p-5">
        {gmail.length === 0 ? <p className="text-sm text-warning">{t("اربط حساب Gmail أولًا من صفحة الحسابات.", "Connect a Gmail account first.")} <Link href="/accounts" className="text-primary">{t("الحسابات", "Accounts")}</Link></p> :
          <div className="grid gap-3 md:grid-cols-2"><Field label={t("المرسل", "From")}><select className="input" value={f.socialAccountId} onChange={set("socialAccountId")}>{gmail.map((a: any) => <option key={a.id} value={a.id}>{a.externalId}</option>)}</select></Field>
            <Field label={t("المستلمون", "Recipients")}><select className="input" value={f.groupId} onChange={set("groupId")}><option value="">—</option>{groups?.map((g) => <option key={g.id} value={g.id}>{g.name} ({g._count.members})</option>)}</select></Field></div>}
        <div className="flex flex-wrap items-end gap-2"><Field label={t("إرسال تجربة إلى", "Send test to")}><input className="input" dir="ltr" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={t("(افتراضيًا: المرسل)", "(default: sender)")} /></Field>
          <Button variant="outline" onClick={() => test(false)} loading={busy === "test"} disabled={!f.socialAccountId}>{t("تجربة", "Test")}</Button><Button variant="outline" onClick={() => test(true)} loading={busy === "draft"} disabled={!f.socialAccountId}><FileText className="h-4 w-4" />{t("مسودة Gmail", "Gmail draft")}</Button></div>
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3"><Button variant="outline" onClick={draftOnly} loading={busy === "save"} disabled={!f.subject}>{t("حفظ كمسودة", "Save draft")}</Button>
          <input type="datetime-local" className="input w-auto" value={sched} onChange={(e) => setSched(e.target.value)} /><Button variant="outline" onClick={() => send("schedule")} loading={busy === "schedule"} disabled={!sched || !f.groupId}><CalendarDays className="h-4 w-4" />{t("جدولة", "Schedule")}</Button>
          <Button onClick={() => send("now")} loading={busy === "now"} disabled={!f.groupId || !f.subject}><Send className="h-4 w-4" />{t("إرسال الآن", "Send now")}</Button></div>
        <p className="text-xs text-subtle">{t("يُضاف رابط إلغاء الاشتراك وترويسة List-Unsubscribe تلقائيًا. أرسل فقط لمن وافق على استلام رسائلك.", "An unsubscribe link and List-Unsubscribe header are added automatically. Only email people who opted in.")}</p>
      </Card>
    </div>
    <Card className="h-fit overflow-hidden xl:sticky xl:top-20"><div className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm"><Eye className="h-4 w-4" />{t("معاينة", "Preview")}<Badge>{f.subject || "—"}</Badge></div><iframe sandbox="" srcDoc={html} className="h-[760px] w-full bg-white" /></Card>
  </div>;
}

function Contacts() {
  const t = useT(); const toast = useToast();
  const { data: groups, reload: rg } = useApi<any[]>("/api/email/groups");
  const [gid, setGid] = useState(""); const [q, setQ] = useState("");
  const { data: contacts, loading, reload } = useApi<any[]>(`/api/email/contacts?groupId=${gid}&q=${encodeURIComponent(q)}`);
  const [imp, setImp] = useState(false); const [text, setText] = useState(""); const [consent, setConsent] = useState(false); const [impGroup, setImpGroup] = useState(""); const [newGroup, setNewGroup] = useState(""); const [sel, setSel] = useState<string[]>([]);
  const parsed = useMemo(() => text.split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((x) => x.trim())).filter((r) => /@/.test(r[0] ?? "") || /@/.test(r[1] ?? "")).map((r) => (/@/.test(r[0]) ? { email: r[0], name: r[1] || null } : { email: r[1], name: r[0] || null })), [text]);
  async function doImport() { try { const r = await api("/api/email/contacts", { body: { contacts: parsed.map((p) => ({ ...p, tags: [] })), groupId: impGroup || null, consent: true } }); toast.success(t(`تمت إضافة ${r.created}`, `Added ${r.created}`)); setImp(false); setText(""); reload(true); rg(true); } catch (e) { toast.error(e); } }
  async function addGroup() { try { await api("/api/email/groups", { body: { name: newGroup } }); setNewGroup(""); rg(true); } catch (e) { toast.error(e); } }
  async function assign(groupId: string) { try { await api(`/api/email/groups/${groupId}`, { method: "PATCH", body: { add: sel } }); setSel([]); toast.success(t("أُضيفت إلى المجموعة", "Added to group")); reload(true); rg(true); } catch (e) { toast.error(e); } }
  async function remove() { try { await api("/api/email/contacts", { method: "DELETE", body: { ids: sel } }); setSel([]); reload(true); rg(true); } catch (e) { toast.error(e); } }
  return <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
    <Card className="h-fit space-y-2 p-3"><div className="text-xs font-semibold text-subtle">{t("المجموعات", "Groups")}</div>
      <button onClick={() => setGid("")} className={`w-full rounded-lg px-2 py-1.5 text-start text-sm ${gid === "" ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>{t("كل جهات الاتصال", "All contacts")}</button>
      {groups?.map((g) => <div key={g.id} className={`group flex items-center rounded-lg px-2 py-1.5 text-sm ${gid === g.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}><button className="flex-1 text-start" onClick={() => setGid(g.id)}>{g.name} <span className="text-xs text-subtle">({g._count.members})</span></button><button className="opacity-0 group-hover:opacity-100" onClick={async () => { await api(`/api/email/groups/${g.id}`, { method: "DELETE" }); rg(true); }}><Trash2 className="h-3.5 w-3.5 text-danger" /></button></div>)}
      <div className="flex gap-1 pt-2"><input className="input h-8 py-0" placeholder={t("مجموعة جديدة", "New group")} value={newGroup} onChange={(e) => setNewGroup(e.target.value)} /><Button className="h-8 px-2" onClick={addGroup} disabled={!newGroup.trim()}><Plus className="h-4 w-4" /></Button></div></Card>
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2"><input className="input flex-1" placeholder={t("بحث...", "Search...")} value={q} onChange={(e) => setQ(e.target.value)} /><Button onClick={() => setImp(true)}><Upload className="h-4 w-4" />{t("إضافة / استيراد CSV", "Add / import CSV")}</Button>
        {sel.length > 0 && <><select className="input w-auto" defaultValue="" onChange={(e) => e.target.value && assign(e.target.value)}><option value="">{t("إضافة المحدد إلى مجموعة...", "Add selected to group...")}</option>{groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select><Button variant="ghost" className="text-danger" onClick={remove}><Trash2 className="h-4 w-4" />({sel.length})</Button></>}</div>
      {loading || !contacts ? <SkeletonList /> : contacts.length === 0 ? <EmptyState icon={<Users />} title={t("لا توجد جهات اتصال", "No contacts")} /> :
        <Card className="divide-y divide-border">{contacts.map((c) => <label key={c.id} className="flex items-center gap-3 p-2.5 text-sm"><input type="checkbox" checked={sel.includes(c.id)} onChange={() => setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : [...sel, c.id])} /><span className="flex-1"><b className="font-medium">{c.name ?? "—"}</b> <span className="text-subtle" dir="ltr">{c.email}</span></span>{c.groups.map((g: any) => <Badge key={g.group.id}>{g.group.name}</Badge>)}{!c.subscribed && <Badge tone="danger">{t("ألغى الاشتراك", "Unsubscribed")}</Badge>}</label>)}</Card>}
    </div>
    <Modal open={imp} onClose={() => setImp(false)} size="lg" title={t("إضافة جهات اتصال", "Add contacts")} footer={<Button onClick={doImport} disabled={!parsed.length || !consent}>{t("إضافة", "Add")} ({parsed.length})</Button>}>
      <div className="space-y-3"><Field label={t("الصق أو اكتب: البريد، الاسم (سطر لكل جهة) — أو ارفع ملف CSV", "Paste: email, name (one per line) — or upload CSV")}><textarea className="input min-h-[180px] font-mono text-xs" dir="ltr" value={text} onChange={(e) => setText(e.target.value)} placeholder={"ali@example.com, Ali\nsara@example.com, Sara"} /></Field>
        <input type="file" accept=".csv,text/csv,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
        <Field label={t("إضافة إلى مجموعة", "Add to group")}><select className="input" value={impGroup} onChange={(e) => setImpGroup(e.target.value)}><option value="">—</option>{groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
        <Toggle checked={consent} onChange={setConsent} label={t("أؤكد أن هذه الجهات وافقت على استلام رسائل تسويقية", "I confirm these contacts opted in to marketing email")} /></div>
    </Modal>
  </div>;
}
export default function Page() { return <Suspense><EmailPage /></Suspense>; }
