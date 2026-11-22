"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings, Save, KeyRound, Plug, ShieldCheck, CreditCard, ScrollText, Bot, Copy, Activity, Trash2, CheckCircle2, XCircle, ExternalLink, Palette, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, Tabs, SkeletonList, ErrorBox, Button, Field, Badge, Modal, useToast } from "@/components/ui";
import { PlatformIcon } from "@/components/platform-icon";
import { StatusBadge } from "@/components/status";
import { MediaPicker, fileUrl, fmtBytes } from "@/components/media";
import { usePerms } from "@/components/shell";
import { api } from "@/lib/client";

function SettingsPage() {
  const t = useT(); const sp = useSearchParams(); const router = useRouter();
  const [tab, setTab] = useState(sp.get("tab") ?? "general");
  const { data, loading, error, reload } = useApi<any>("/api/settings");
  useEffect(() => { router.replace(`/settings?tab=${tab}`, { scroll: false }); }, [tab, router]);
  return <div>
    <PageHeader icon={<Settings />} title={t("الإعدادات", "Settings")} />
    <Tabs className="mb-5" value={tab} onChange={setTab} items={[
      { value: "general", label: <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" />{t("عام والهوية", "General")}</span> },
      { value: "ai", label: <span className="flex items-center gap-1.5"><Bot className="h-3.5 w-3.5" />{t("الذكاء الاصطناعي", "AI")}</span> },
      { value: "integrations", label: <span className="flex items-center gap-1.5"><Plug className="h-3.5 w-3.5" />{t("التكاملات", "Integrations")}</span> },
      { value: "security", label: <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />{t("الأمان", "Security")}</span> },
      { value: "plan", label: <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />{t("الخطة والاستخدام", "Plan & usage")}</span> },
      { value: "audit", label: <span className="flex items-center gap-1.5"><ScrollText className="h-3.5 w-3.5" />{t("سجل العمليات", "Audit log")}</span> },
    ]} />
    {error ? <ErrorBox error={error} onRetry={reload} /> : loading || !data ? <SkeletonList /> :
      tab === "general" ? <General data={data} reload={reload} /> : tab === "ai" ? <AI data={data} reload={reload} /> : tab === "integrations" ? <Integrations data={data} reload={reload} /> :
        tab === "security" ? <Security data={data} /> : tab === "plan" ? <Plan data={data} /> : <Audit />}
  </div>;
}

function General({ data, reload }: { data: any; reload: () => void }) {
  const t = useT(); const toast = useToast(); const can = usePerms();
  const [f, setF] = useState({ workspaceName: data.workspace.name, timezone: data.workspace.timezone, emailDailyCap: data.email.dailyCap, ...data.branding }); const [busy, setBusy] = useState(false); const [pick, setPick] = useState(false);
  async function save() { setBusy(true); try { await api("/api/settings", { method: "PUT", body: { workspaceName: f.workspaceName, timezone: f.timezone, emailDailyCap: Number(f.emailDailyCap), branding: { appName: f.appName, appNameAr: f.appNameAr, tagline: f.tagline, primaryColor: f.primaryColor, logoAssetId: f.logoAssetId ?? null } } }); toast.success(t("تم الحفظ", "Saved")); reload(); window.location.reload(); } catch (e) { toast.error(e); } finally { setBusy(false); } }
  const tzs = ["Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain", "Asia/Muscat", "Africa/Cairo", "Asia/Amman", "Asia/Beirut", "Asia/Baghdad", "Africa/Casablanca", "Africa/Tunis", "Africa/Algiers", "Europe/London", "UTC"];
  return <Card className="max-w-3xl space-y-4 p-6">
    <div className="grid gap-3 md:grid-cols-2">
      <Field label={t("اسم مساحة العمل", "Workspace name")}><input className="input" value={f.workspaceName} onChange={(e) => setF({ ...f, workspaceName: e.target.value })} /></Field>
      <Field label={t("المنطقة الزمنية", "Timezone")}><select className="input" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>{tzs.map((z) => <option key={z}>{z}</option>)}</select></Field>
    </div>
    <h3 className="border-t border-border pt-4 font-semibold">{t("اسم المنصة وشعارها وألوانها", "Platform name, logo & colors")}</h3>
    <div className="grid gap-3 md:grid-cols-2">
      <Field label={t("الاسم العربي", "Arabic name")}><input className="input" value={f.appNameAr} onChange={(e) => setF({ ...f, appNameAr: e.target.value })} /></Field>
      <Field label={t("الاسم الإنجليزي", "English name")}><input className="input" value={f.appName} onChange={(e) => setF({ ...f, appName: e.target.value })} /></Field>
      <Field label={t("الشعار الوصفي", "Tagline")} className="md:col-span-2"><input className="input" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></Field>
      <Field label={t("اللون الرئيسي", "Primary color")}><div className="flex gap-2"><input type="color" className="h-10 w-14 rounded-lg" value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} /><input className="input" dir="ltr" value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} /></div></Field>
      <Field label={t("الشعار", "Logo")}><div className="flex items-center gap-2">{f.logoAssetId && <img src={fileUrl(f.logoAssetId)} alt="" className="h-10 w-10 rounded object-contain" />}<Button variant="outline" onClick={() => setPick(true)}>{t("اختيار", "Choose")}</Button></div></Field>
      <Field label={t("الحد اليومي لإرسال Gmail", "Gmail daily send cap")} hint={t("Google: ~500 للحسابات الشخصية و2000 لـ Workspace", "Google: ~500 personal, 2000 Workspace")}><input type="number" className="input" min={1} max={2000} value={f.emailDailyCap} onChange={(e) => setF({ ...f, emailDailyCap: e.target.value })} /></Field>
    </div>
    {can("settings.manage") && <Button onClick={save} loading={busy}><Save className="h-4 w-4" />{t("حفظ", "Save")}</Button>}
    <MediaPicker open={pick} kind="image" onClose={() => setPick(false)} onPick={(a) => setF({ ...f, logoAssetId: a[0]?.id })} />
    {data.isOwner && <DangerZone name={data.workspace.name} />}
  </Card>;
}

function DangerZone({ name }: { name: string }) {
  const t = useT(); const toast = useToast(); const [open, setOpen] = useState(false); const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false);
  async function go() { setBusy(true); try { await api("/api/settings/organization", { method: "DELETE", body: { confirm } }); window.location.href = "/register"; } catch (e) { toast.error(e); setBusy(false); } }
  return <div className="mt-6 rounded-xl border border-danger/40 p-4"><h4 className="flex items-center gap-2 font-semibold text-danger"><AlertTriangle className="h-4 w-4" />{t("منطقة الخطر", "Danger zone")}</h4>
    <p className="my-2 text-sm text-subtle">{t("حذف المؤسسة نهائيًا: إلغاء صلاحيات كل الحسابات المرتبطة، حذف كل الملفات والبيانات. لا يمكن التراجع.", "Permanently delete the organization: revoke all connected accounts, delete all files and data. Irreversible.")}</p>
    <Button variant="danger" onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" />{t("حذف المؤسسة وكل البيانات", "Delete organization & all data")}</Button>
    <Modal open={open} onClose={() => setOpen(false)} size="sm" title={t("تأكيد الحذف النهائي", "Confirm permanent deletion")} footer={<Button variant="danger" loading={busy} disabled={confirm !== name} onClick={go}>{t("حذف نهائي", "Delete forever")}</Button>}>
      <Field label={t(`اكتب "${name}" للتأكيد`, `Type "${name}" to confirm`)}><input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field></Modal>
  </div>;
}

function AI({ data, reload }: { data: any; reload: () => void }) {
  const t = useT(); const toast = useToast();
  const [cfg, setCfg] = useState(data.ai.config); const [keys, setKeys] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(""); const [test, setTest] = useState<any>(null);
  async function save() { setBusy("save"); try { await api("/api/settings/ai", { method: "PUT", body: { config: cfg, keys } }); setKeys({}); toast.success(t("تم الحفظ (المفاتيح مشفرة ولا تُعرض مجددًا)", "Saved (keys are encrypted and never shown again)")); reload(); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function remove(k: string) { try { await api("/api/settings/ai", { method: "PUT", body: { keys: { [k]: null } } }); reload(); } catch (e) { toast.error(e); } }
  async function runTest() { setBusy("test"); setTest(null); try { setTest(await api("/api/settings/ai/test", { method: "POST" })); } catch (e) { setTest({ error: (e as Error).message }); } finally { setBusy(""); } }
  const KEY_INFO: Record<string, [string, string]> = { anthropic: ["Anthropic (Claude) — النصوص والمساعد والتحليل", "Anthropic (Claude) — text, assistant, analysis"], openai: ["OpenAI — الصور، الصوت، التفريغ النصي (ونصوص اختياريًا)", "OpenAI — images, TTS, speech-to-text (optional text)"], stability: ["Stability AI — توليد الصور (بديل)", "Stability AI — image generation (alternative)"], elevenlabs: ["ElevenLabs — تعليق صوتي عربي عالي الجودة (بديل)", "ElevenLabs — high-quality Arabic voice (alternative)"] };
  return <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
    <Card className="space-y-4 p-6"><h3 className="font-semibold">{t("المزودون والنماذج", "Providers & models")}</h3>
      <p className="text-xs text-subtle">{t("طبقة مزودين قابلة للتبديل: يمكنك تغيير المزود لكل نوع دون تعديل الكود.", "Swappable provider layer: change the provider per capability without code changes.")}</p>
      <div className="grid grid-cols-2 gap-2"><Field label={t("النماذج اللغوية", "LLM")}><select className="input" value={cfg.llm.provider} onChange={(e) => setCfg({ ...cfg, llm: { provider: e.target.value, model: e.target.value === "anthropic" ? "claude-opus-5-5" : "gpt-5" } })}><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option></select></Field><Field label={t("النموذج", "Model")}><input className="input" dir="ltr" value={cfg.llm.model} onChange={(e) => setCfg({ ...cfg, llm: { ...cfg.llm, model: e.target.value } })} /></Field></div>
      <div className="grid grid-cols-2 gap-2"><Field label={t("توليد الصور", "Images")}><select className="input" value={cfg.image.provider} onChange={(e) => setCfg({ ...cfg, image: { provider: e.target.value, model: e.target.value === "openai" ? "gpt-image-1" : "core" } })}><option value="openai">OpenAI</option><option value="stability">Stability AI</option></select></Field><Field label={t("النموذج", "Model")}><input className="input" dir="ltr" value={cfg.image.model} onChange={(e) => setCfg({ ...cfg, image: { ...cfg.image, model: e.target.value } })} /></Field></div>
      <div className="grid grid-cols-2 gap-2"><Field label={t("تحويل النص لصوت", "Text-to-speech")}><select className="input" value={cfg.tts.provider} onChange={(e) => setCfg({ ...cfg, tts: { provider: e.target.value, voice: e.target.value === "openai" ? "alloy" : "" } })}><option value="openai">OpenAI</option><option value="elevenlabs">ElevenLabs</option></select></Field><Field label={t("الصوت (Voice ID)", "Voice")}><input className="input" dir="ltr" value={cfg.tts.voice} onChange={(e) => setCfg({ ...cfg, tts: { ...cfg.tts, voice: e.target.value } })} /></Field></div>
      <Field label={t("تحويل الصوت لنص", "Speech-to-text")}><select className="input" value="openai" disabled><option>OpenAI Whisper</option></select></Field>
      <div className="flex flex-wrap items-center gap-2"><Button onClick={save} loading={busy === "save"}><Save className="h-4 w-4" />{t("حفظ", "Save")}</Button><Button variant="outline" onClick={runTest} loading={busy === "test"}><Activity className="h-4 w-4" />{t("اختبار النموذج اللغوي", "Test LLM")}</Button></div>
      {test && (test.error ? <p className="rounded-lg bg-danger/10 p-2 text-xs text-danger">{test.error}</p> : <p className="rounded-lg bg-success/10 p-2 text-xs text-success">✓ {test.provider} / {test.model}: {test.reply}</p>)}
    </Card>
    <Card className="space-y-3 p-6"><h3 className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" />{t("مفاتيح API", "API keys")}</h3>
      <p className="text-xs text-subtle">{t("تُخزن مشفرة (AES-256-GCM) في الخادم ولا تُرسل إلى المتصفح أبدًا. يمكن أيضًا ضبطها كمتغيرات بيئة.", "Stored encrypted (AES-256-GCM) server-side and never sent to the browser. Env variables also work.")}</p>
      {Object.keys(KEY_INFO).map((k) => <Field key={k} label={<span className="flex items-center gap-2">{t(KEY_INFO[k][0], KEY_INFO[k][1])}{data.ai.keys[k] ? <Badge tone="success">{t("مُعد", "Set")}</Badge> : <Badge>{t("غير مُعد", "Not set")}</Badge>}</span>}>
        <div className="flex gap-2"><input className="input" type="password" dir="ltr" autoComplete="off" placeholder={data.ai.keys[k] ? "••••••••••••  (" + t("اتركه فارغًا للإبقاء", "leave empty to keep") + ")" : "sk-..."} value={keys[k] ?? ""} onChange={(e) => setKeys({ ...keys, [k]: e.target.value })} />
          {data.ai.keys[k] && <Button variant="ghost" className="text-danger" onClick={() => remove(k)}><Trash2 className="h-4 w-4" /></Button>}</div></Field>)}
    </Card>
  </div>;
}

function Integrations({ data, reload }: { data: any; reload: () => void }) {
  const t = useT(); const locale = useLocale(); const toast = useToast();
  const [edit, setEdit] = useState<any>(null); const [health, setHealth] = useState<any[] | null>(null); const [busy, setBusy] = useState("");
  async function save() { setBusy("save"); try { await api(`/api/settings/integrations/${edit.id}`, { method: "PUT", body: { clientId: edit.clientId, clientSecret: edit.clientSecret } }); setEdit(null); toast.success(t("تم حفظ بيانات التطبيق", "App credentials saved")); reload(); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function check() { setBusy("health"); try { setHealth(await api("/api/settings/health", { method: "POST" })); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  const DOCS: Record<string, [string, string]> = {
    google: ["أنشئ OAuth Client (Web) في Google Cloud Console، فعّل Gmail API وYouTube Data API v3، وأضف رابط إعادة التوجيه أدناه. نطاقات Gmail/YouTube الحساسة تتطلب التحقق من التطبيق للنشر العام.", "Create a Web OAuth client in Google Cloud Console, enable Gmail API and YouTube Data API v3, add the redirect URI. Sensitive scopes require app verification for public use."],
    instagram: ["أنشئ تطبيق Meta من نوع Business وأضف منتج Instagram (Instagram API with Instagram Login). تحتاج صلاحيات النشر إلى App Review. الحساب يجب أن يكون Business أو Creator.", "Create a Meta Business app and add the Instagram product (Instagram API with Instagram Login). Publishing permissions need App Review. Account must be Business/Creator."],
    x: ["أنشئ مشروعًا وتطبيقًا في X Developer Portal، فعّل OAuth 2.0 (Confidential client) وأضف رابط إعادة التوجيه. الكتابة تتطلب خطة API تدعمها.", "Create a project & app in the X Developer Portal, enable OAuth 2.0 (confidential client), add the redirect URI. Writing requires a plan that allows it."],
    tiktok: ["أنشئ تطبيقًا في TikTok for Developers وأضف Login Kit وContent Posting API (Direct Post). قبل التدقيق تُنشر الفيديوهات بخصوصية SELF_ONLY.", "Create an app in TikTok for Developers with Login Kit and Content Posting API (Direct Post). Before audit, posts are SELF_ONLY."],
    snapchat: ["أنشئ OAuth App في Snapchat Business Manager (Marketing API). يتيح إدارة الحملات الإعلانية فقط؛ النشر العضوي يدوي.", "Create an OAuth app in Snapchat Business Manager (Marketing API). Ads management only; organic posting is manual."],
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><p className="flex-1 text-sm text-subtle">{t("كل تكامل مستقل: OAuth، إدارة التوكنات والتجديد، حدود المعدل وإعادة المحاولة، السجلات وفحص الصحة.", "Each integration is independent: OAuth, token refresh, rate limits & retries, logs and health checks.")}</p><Button variant="outline" onClick={check} loading={busy === "health"}><Activity className="h-4 w-4" />{t("فحص صحة الاتصالات", "Run health check")}</Button></div>
    {health && <Card className="p-4"><h4 className="mb-2 text-sm font-semibold">{t("نتيجة الفحص", "Health check")}</h4>{health.length === 0 ? <p className="text-sm text-subtle">{t("لا توجد حسابات مرتبطة", "No connected accounts")}</p> : <div className="space-y-1">{health.map((h) => <div key={h.accountId} className="flex items-center gap-2 text-sm"><PlatformIcon platform={h.platform} size={16} />{h.name}{h.ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}<span className="text-xs text-subtle">{h.ms}ms</span>{h.error && <span className="truncate text-xs text-danger">{h.error}</span>}</div>)}</div>}</Card>}
    <div className="grid gap-4 lg:grid-cols-2">{data.integrations.map((p: any) => <Card key={p.id} className="space-y-3 p-5">
      <div className="flex items-center gap-2"><div className="flex">{p.platforms.map((x: string) => <PlatformIcon key={x} platform={x} size={24} />)}</div><h3 className="flex-1 font-semibold">{p.name}</h3>{p.configured ? <Badge tone="success">{t("مُعد", "Configured")}{p.source === "env" && " (env)"}</Badge> : <Badge tone="warning">{t("غير مُعد", "Not configured")}</Badge>}</div>
      <p className="text-xs leading-6 text-subtle">{t(DOCS[p.id][0], DOCS[p.id][1])} <a href={p.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary">{t("لوحة المطورين", "Developer console")}<ExternalLink className="h-3 w-3" /></a></p>
      <Field label="Redirect URI"><div className="flex gap-1"><code className="input truncate text-xs" dir="ltr">{p.redirectUri}</code><button className="btn-ghost px-2" onClick={() => { void navigator.clipboard.writeText(p.redirectUri); toast.success(t("تم النسخ", "Copied")); }}><Copy className="h-4 w-4" /></button></div></Field>
      <details className="text-xs"><summary className="cursor-pointer text-subtle">{t("النطاقات المطلوبة", "Requested scopes")}</summary><div className="mt-1 flex flex-wrap gap-1" dir="ltr">{p.scopes.map((s: string) => <code key={s} className="rounded bg-muted px-1.5 py-0.5">{s.replace("https://www.googleapis.com/auth/", "")}</code>)}</div></details>
      {p.connections.length > 0 && <div className="space-y-1.5 rounded-xl bg-muted/50 p-3">{p.connections.map((cn: any) => <div key={cn.id} className="text-xs"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={cn.status === "active" ? "connected" : cn.status === "expired" ? "needs_reauth" : cn.status} />{cn.accounts.map((a: any) => <span key={a.id} className="flex items-center gap-1"><PlatformIcon platform={a.platform} size={14} />{a.displayName}</span>)}</div>
        <div className="mt-0.5 text-subtle">{cn.expiresAt && <>{t("انتهاء التوكن", "Token expiry")}: {new Date(cn.expiresAt).toLocaleString(locale)} · </>}{cn.lastRefreshedAt && <>{t("آخر تجديد", "Refreshed")}: {new Date(cn.lastRefreshedAt).toLocaleString(locale)}</>}</div>{cn.lastError && <div className="text-danger">{cn.lastError}</div>}</div>)}</div>}
      {p.lastOperation && <p className="text-xs text-subtle">{t("آخر عملية", "Last operation")}: <span className={p.lastOperation.level === "error" ? "text-danger" : ""}>{p.lastOperation.message}</span> · {new Date(p.lastOperation.createdAt).toLocaleString(locale)}</p>}
      <div className="flex gap-2"><Button variant="outline" onClick={() => setEdit({ id: p.id, name: p.name, clientId: p.source === "workspace" ? p.clientId : "", clientSecret: "" })}><KeyRound className="h-4 w-4" />{p.configured ? t("تحديث بيانات التطبيق", "Update app credentials") : t("إعداد التطبيق", "Configure app")}</Button>
        {p.source === "workspace" && <Button variant="ghost" className="text-danger" onClick={async () => { await api(`/api/settings/integrations/${p.id}`, { method: "DELETE" }); reload(); }}><Trash2 className="h-4 w-4" /></Button>}</div>
    </Card>)}</div>
    {edit && <Modal open onClose={() => setEdit(null)} title={edit.name} footer={<Button onClick={save} loading={busy === "save"} disabled={!edit.clientId || !edit.clientSecret}>{t("حفظ", "Save")}</Button>}>
      <div className="space-y-3"><Field label={edit.id === "tiktok" ? "Client Key" : "Client ID / App ID"}><input className="input" dir="ltr" value={edit.clientId} onChange={(e) => setEdit({ ...edit, clientId: e.target.value })} /></Field>
        <Field label="Client Secret" hint={t("يُشفر ويخزن على الخادم فقط", "Encrypted and stored server-side only")}><input className="input" type="password" dir="ltr" autoComplete="off" value={edit.clientSecret} onChange={(e) => setEdit({ ...edit, clientSecret: e.target.value })} /></Field></div>
    </Modal>}
  </div>;
}

function Security({ data }: { data: any }) {
  const t = useT(); const toast = useToast(); void data;
  const { data: me, reload } = useApi<any>("/api/auth/me");
  const [pw, setPw] = useState({ current: "", next: "" }); const [mfa, setMfa] = useState<any>(null); const [code, setCode] = useState(""); const [busy, setBusy] = useState("");
  async function changePw() { setBusy("pw"); try { await api("/api/auth/password", { body: pw }); setPw({ current: "", next: "" }); toast.success(t("تم تغيير كلمة المرور", "Password changed")); } catch (e) { toast.error(e); } finally { setBusy(""); } }
  async function mfaAction(action: string) { setBusy(action); try { const r = await api("/api/auth/mfa", { method: "PUT", body: { action, code } }); if (action === "setup") setMfa(r); else { setMfa(null); setCode(""); toast.success(action === "enable" ? t("تم تفعيل التحقق بخطوتين", "2FA enabled") : t("تم إيقاف التحقق بخطوتين", "2FA disabled")); reload(true); } } catch (e) { toast.error(e); } finally { setBusy(""); } }
  return <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
    <Card className="space-y-3 p-6"><h3 className="font-semibold">{t("تغيير كلمة المرور", "Change password")}</h3>
      <Field label={t("الحالية", "Current")}><input className="input" type="password" dir="ltr" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
      <Field label={t("الجديدة (10 أحرف+)", "New (10+ chars)")}><input className="input" type="password" dir="ltr" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
      <Button onClick={changePw} loading={busy === "pw"} disabled={pw.next.length < 10}>{t("تحديث", "Update")}</Button></Card>
    <Card className="space-y-3 p-6"><h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />{t("التحقق بخطوتين (MFA)", "Two-factor auth (MFA)")}{me?.user.mfaEnabled && <Badge tone="success">{t("مفعل", "Enabled")}</Badge>}</h3>
      {me?.user.mfaEnabled ? <><p className="text-sm text-subtle">{t("لإيقافه أدخل رمزًا حاليًا من التطبيق.", "Enter a current code to disable.")}</p><input className="input text-center tracking-widest" dir="ltr" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /><Button variant="danger" onClick={() => mfaAction("disable")} loading={busy === "disable"}>{t("إيقاف", "Disable")}</Button></> :
        mfa ? <><p className="text-sm text-subtle">{t("امسح الرمز بتطبيق المصادقة (Google Authenticator / 1Password...) ثم أدخل الرمز.", "Scan with your authenticator app, then enter the code.")}</p><img src={mfa.qr} alt="QR" className="mx-auto h-44 w-44 rounded-lg bg-white p-2" /><code className="block text-center text-xs" dir="ltr">{mfa.secret}</code><input className="input text-center tracking-widest" dir="ltr" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /><Button onClick={() => mfaAction("enable")} loading={busy === "enable"}>{t("تفعيل", "Enable")}</Button></> :
          <Button variant="outline" onClick={() => mfaAction("setup")} loading={busy === "setup"}>{t("إعداد التحقق بخطوتين", "Set up 2FA")}</Button>}
    </Card>
    <Card className="p-6 text-sm leading-7 text-subtle lg:col-span-2"><h3 className="mb-2 font-semibold text-fg">{t("ممارسات الأمان المطبقة", "Security practices in place")}</h3>
      <ul className="grid list-disc gap-x-6 ps-5 sm:grid-cols-2">{[["تشفير التوكنات والمفاتيح AES-256-GCM", "Tokens & keys encrypted AES-256-GCM"], ["OAuth 2.0 مع PKCE وحالة state لمرة واحدة", "OAuth 2.0 with PKCE and one-time state"], ["حماية CSRF (SameSite + فحص Origin)", "CSRF protection (SameSite + Origin check)"], ["CSP وترويسات أمان ضد XSS وClickjacking", "CSP & security headers vs XSS/clickjacking"], ["تحديد معدل الطلبات عبر Redis", "Redis-backed rate limiting"], ["التحقق من المدخلات بـ Zod على الخادم", "Server-side input validation with Zod"], ["صلاحيات تُفرض على مستوى الخادم", "Permissions enforced server-side"], ["سجل تدقيق لكل العمليات المهمة", "Audit log of all important actions"], ["فحص نوع الملفات المرفوعة (magic bytes) وتعقيم SVG", "Upload type sniffing (magic bytes) & SVG sanitizing"], ["روابط وسائط موقعة ومؤقتة للمنصات", "Signed, expiring media URLs for platforms"], ["جلسات httpOnly قابلة للإلغاء", "Revocable httpOnly sessions"], ["حذف كامل للمؤسسة والبيانات", "Full organization & data deletion"]].map(([a, e]) => <li key={a}>{t(a, e)}</li>)}</ul></Card>
  </div>;
}

function Plan({ data }: { data: any }) {
  const t = useT(); const { plan, limits, usage, plans } = data.plan;
  const rows: [string, string, string, (v: number) => string][] = [["accounts", "الحسابات المرتبطة", "Connected accounts", String], ["postsPerMonth", "المنشورات هذا الشهر", "Posts this month", String], ["users", "المستخدمون", "Users", String], ["aiTextRequests", "طلبات الذكاء الاصطناعي النصية", "AI text requests", String], ["aiImages", "توليد الصور", "AI images", String], ["videos", "إخراج الفيديو", "Video renders", String], ["storageMb", "التخزين", "Storage", (v) => fmtBytes(v * 1048576)], ["campaigns", "الحملات", "Campaigns", String]];
  return <div className="grid max-w-5xl gap-4 lg:grid-cols-[1fr_1fr]">
    <Card className="p-6"><div className="mb-4 flex items-center gap-2"><h3 className="font-semibold">{t("الخطة الحالية", "Current plan")}</h3><Badge tone="primary">{plan?.name ?? "—"}</Badge></div>
      <div className="space-y-3">{rows.map(([k, a, e, f]) => { const lim = limits?.[k]; const u = usage[k]; const pct = lim > 0 ? Math.min(100, (u / lim) * 100) : 0; return <div key={k}><div className="flex justify-between text-sm"><span>{t(a, e)}</span><span className="tabular-nums text-subtle">{f(Math.round(u * 10) / 10)} / {lim === -1 ? "∞" : f(lim)}</span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={clsx("h-full rounded-full", pct > 90 ? "bg-danger" : pct > 70 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} /></div></div>; })}</div></Card>
    <Card className="p-6"><h3 className="mb-1 font-semibold">{t("الخطط", "Plans")}</h3><p className="mb-4 text-xs text-subtle">{t("نظام الخطط والحدود مفعّل. ربط بوابة الدفع (Stripe/Moyasar/Tap) يتم عبر جدول الاشتراكات دون إعادة بناء النظام.", "Plans & limits are enforced. A payment gateway (Stripe/Moyasar/Tap) plugs into the subscriptions table without a rebuild.")}</p>
      <div className="space-y-2">{plans.map((p: any) => <div key={p.id} className={clsx("flex items-center gap-3 rounded-xl border p-3", plan?.id === p.id ? "border-primary bg-primary/5" : "border-border")}><b className="w-24">{p.name}</b><span className="flex-1 text-xs text-subtle">{p.limits.accounts === -1 ? "∞" : p.limits.accounts} {t("حساب", "accounts")} · {p.limits.users === -1 ? "∞" : p.limits.users} {t("مستخدم", "users")} · {p.limits.aiImages === -1 ? "∞" : p.limits.aiImages} {t("صورة", "images")}</span><span className="text-sm font-semibold">{Number(p.priceMonthly) ? `$${Number(p.priceMonthly)}` : p.key === "enterprise" ? t("تواصل", "Contact") : t("مجاني", "Free")}</span></div>)}</div></Card>
  </div>;
}

function Audit() {
  const t = useT(); const locale = useLocale(); const [filter, setFilter] = useState("");
  const { data, loading } = useApi<any[]>(`/api/settings/audit?action=${filter}`);
  return <Card className="p-4"><div className="mb-3 flex gap-2"><select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">{t("كل العمليات", "All actions")}</option>{["auth", "post", "account", "media", "campaign", "settings", "user", "integration", "brand", "video", "inbox"].map((a) => <option key={a}>{a}</option>)}</select></div>
    {loading || !data ? <SkeletonList /> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="text-xs text-subtle"><th className="p-2 text-start">{t("الوقت", "Time")}</th><th className="p-2 text-start">{t("المستخدم", "User")}</th><th className="p-2 text-start">{t("العملية", "Action")}</th><th className="p-2 text-start">{t("الكيان", "Entity")}</th><th className="p-2 text-start">IP</th></tr></thead>
      <tbody className="divide-y divide-border">{data.map((l) => <tr key={l.id}><td className="p-2 text-xs text-subtle">{new Date(l.createdAt).toLocaleString(locale)}</td><td className="p-2">{l.user?.name ?? "—"}</td><td className="p-2"><code className="text-xs">{l.action}</code></td><td className="p-2 text-xs text-subtle">{l.entityType ?? ""}</td><td className="p-2 text-xs text-subtle" dir="ltr">{l.ip ?? ""}</td></tr>)}</tbody></table></div>}
  </Card>;
}
export default function Page() { return <Suspense><SettingsPage /></Suspense>; }
