"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Users2, RefreshCw, Unplug, Plug, Check, X, Settings, AlertTriangle, Megaphone } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, Button, Badge, SkeletonList, ErrorBox, Confirm, useToast, EmptyState, Modal, Field, Spinner } from "@/components/ui";
import { PlatformIcon } from "@/components/platform-icon";
import { StatusBadge } from "@/components/status";
import { usePerms } from "@/components/shell";
import { api } from "@/lib/client";

const PROVIDER_OF: Record<string, string> = { gmail: "google", youtube: "google", instagram: "instagram", x: "x", tiktok: "tiktok", snapchat: "snapchat" };

function Accounts() {
  const t = useT(); const locale = useLocale(); const toast = useToast(); const can = usePerms(); const sp = useSearchParams();
  const { data, loading, error, reload } = useApi<any>("/api/accounts");
  const [busy, setBusy] = useState<string | null>(null); const [confirm, setConfirm] = useState<any>(null); const [ads, setAds] = useState<any>(null);
  useEffect(() => {
    if (sp.get("connected")) toast.success(t("تم ربط الحساب بنجاح", "Account connected"));
    if (sp.get("error")) toast.error(sp.get("error")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function sync(id: string) {
    setBusy(id);
    try { const r = await api(`/api/accounts/${id}/sync`, { method: "POST" }); r.ok ? toast.success(t("تمت المزامنة", "Synced")) : toast.error(r.errors.join("\n")); reload(true); }
    catch (e) { toast.error(e); } finally { setBusy(null); }
  }
  async function disconnect() {
    setBusy(confirm.id);
    try { await api(`/api/accounts/${confirm.id}`, { method: "DELETE" }); toast.success(t("تم فصل الحساب", "Disconnected")); setConfirm(null); reload(true); }
    catch (e) { toast.error(e); } finally { setBusy(null); }
  }
  const connectUrl = (platform: string) => `/api/oauth/${PROVIDER_OF[platform]}/start?platform=${platform}`;

  return <div>
    <PageHeader icon={<Users2 />} title={t("إدارة الحسابات", "Accounts")} subtitle={t("اربط حساباتك عبر OAuth الرسمي لكل منصة — لا نخزن كلمات المرور أبدًا", "Connect via each platform's official OAuth — we never store passwords")} />
    {error ? <ErrorBox error={error} onRetry={reload} /> : null}
    {loading || !data ? <SkeletonList /> : <>
      <h2 className="mb-3 text-sm font-semibold text-subtle">{t("الحسابات المرتبطة", "Connected accounts")} ({data.accounts.length})</h2>
      {data.accounts.length === 0 ? <EmptyState icon={<Plug />} title={t("لا توجد حسابات مرتبطة", "No connected accounts")} body={t("اختر منصة من الأسفل لبدء الربط.", "Pick a platform below to connect.")} /> :
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.accounts.map((a: any) => <Card key={a.id} className="p-5 animate-in">
            <div className="flex items-start gap-3">
              <div className="relative">{a.avatarUrl ? <img src={a.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-muted font-bold">{a.displayName[0]}</div>}
                <PlatformIcon platform={a.platform} size={20} className="absolute -bottom-1 -end-1 ring-2 ring-surface" /></div>
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{a.displayName}</div><div className="truncate text-xs text-subtle" dir="ltr">{a.username ? (a.platform === "gmail" ? a.username : "@" + a.username.replace(/^@/, "")) : a.externalId}</div></div>
              <StatusBadge status={a.status} />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-muted/60 p-2"><dt className="text-[11px] text-subtle">{t("المتابعون", "Followers")}</dt><dd className="font-semibold tabular-nums">{a.followers == null ? "—" : Intl.NumberFormat("en", { notation: "compact" }).format(a.followers)}</dd></div>
              <div className="rounded-xl bg-muted/60 p-2"><dt className="text-[11px] text-subtle">{t("منشورات", "Posts")}</dt><dd className="font-semibold">{a._count.variants}</dd></div>
              <div className="rounded-xl bg-muted/60 p-2"><dt className="text-[11px] text-subtle">{t("آخر مزامنة", "Last sync")}</dt><dd className="text-xs font-medium">{a.lastSyncAt ? new Date(a.lastSyncAt).toLocaleDateString(locale) : "—"}</dd></div>
            </dl>
            <div className="mt-3 space-y-1 text-xs text-subtle">
              <div>{t("تاريخ الربط", "Connected")}: {new Date(a.connectedAt).toLocaleDateString(locale)}{a.connection?.expiresAt && <> · {t("ينتهي التوكن", "Token expires")}: {new Date(a.connection.expiresAt).toLocaleDateString(locale)}</>}</div>
              <details><summary className="cursor-pointer">{t("الصلاحيات الممنوحة", "Granted permissions")} ({a.permissions.length})</summary><div className="mt-1 flex flex-wrap gap-1" dir="ltr">{a.permissions.filter(Boolean).map((p: string) => <code key={p} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{p.replace("https://www.googleapis.com/auth/", "")}</code>)}</div></details>
            </div>
            {a.lastError && <div className="mt-3 flex gap-2 rounded-lg bg-warning/10 p-2 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span className="line-clamp-3">{a.lastError}</span></div>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" className="flex-1" onClick={() => sync(a.id)} loading={busy === a.id}><RefreshCw className="h-4 w-4" />{t("مزامنة", "Sync")}</Button>
              {can("accounts.connect") && <a href={connectUrl(a.platform)} className="btn-outline flex-1"><Plug className="h-4 w-4" />{t("إعادة الربط", "Reconnect")}</a>}
              {a.platform === "snapchat" && <Button variant="outline" onClick={() => setAds(a)}><Megaphone className="h-4 w-4" />{t("الإعلانات", "Ads")}</Button>}
              {can("accounts.connect") && <Button variant="ghost" className="text-danger" onClick={() => setConfirm(a)}><Unplug className="h-4 w-4" /></Button>}
            </div>
          </Card>)}
        </div>}

      <h2 className="mb-3 mt-10 text-sm font-semibold text-subtle">{t("ربط منصة جديدة", "Connect a platform")}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.platforms.map((p: any) => {
          const configured = data.configured[PROVIDER_OF[p.id]];
          return <Card key={p.id} className="flex flex-col p-5">
            <div className="flex items-center gap-3"><PlatformIcon platform={p.id} size={36} /><div><div className="font-semibold">{locale === "ar" ? p.nameAr : p.name}</div><div className="text-xs text-subtle">{p.formats.join(" · ")}</div></div></div>
            <ul className="mt-4 flex-1 space-y-1.5 text-xs">
              {(["publish", "schedule", "analytics", "comments", "messages"] as const).map((k) => {
                const c = p.capabilities[k];
                const label = { publish: t("النشر المباشر", "Direct publishing"), schedule: t("الجدولة", "Scheduling"), analytics: t("التحليلات", "Analytics"), comments: t("التعليقات", "Comments"), messages: t("الرسائل", "Messages") }[k];
                return <li key={k} className="flex items-start gap-1.5" title={c.note}>{c.supported ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" />}<span className={c.supported ? "" : "text-subtle"}>{label}{c.note && <span className="block text-[11px] text-subtle">{c.note}</span>}</span></li>;
              })}
            </ul>
            <div className="mt-4">
              {!can("accounts.connect") ? <Badge>{t("لا تملك صلاحية الربط", "No permission")}</Badge> :
                configured ? <a href={connectUrl(p.id)} className="btn-primary w-full"><Plug className="h-4 w-4" />{t("ربط الحساب", "Connect")}</a> :
                  <Link href="/settings?tab=integrations" className="btn-outline w-full"><Settings className="h-4 w-4" />{t("أعدّ تطبيق المطور أولًا", "Configure developer app first")}</Link>}
            </div>
          </Card>;
        })}
      </div>
    </>}
    {ads && <SnapAds account={ads} onClose={() => setAds(null)} />}
    <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={disconnect} loading={!!busy} danger title={t("فصل الحساب؟", "Disconnect account?")}
      body={t("سيتم إلغاء الصلاحيات لدى المنصة وحذف التوكنات. يبقى سجل المنشورات محفوظًا.", "Tokens will be revoked and deleted. Post history is kept.")} />
  </div>;
}
function SnapAds({ account, onClose }: { account: any; onClose: () => void }) {
  const t = useT(); const toast = useToast(); const [adId, setAdId] = useState<string>("");
  const { data, loading, error, reload } = useApi<any>(`/api/accounts/${account.id}/snapchat-ads${adId ? `?adAccountId=${adId}` : ""}`);
  const [f, setF] = useState({ name: "", start: "", budget: "" }); const [busy, setBusy] = useState(false);
  async function create() { setBusy(true); try { await api(`/api/accounts/${account.id}/snapchat-ads`, { body: { adAccountId: adId || data.adAccountId, name: f.name, startTime: new Date(f.start).toISOString(), dailyBudget: f.budget ? Number(f.budget) : undefined } }); toast.success(t("أُنشئت الحملة بحالة متوقفة — أكمل الإعلانات من Snapchat Ads Manager", "Campaign created (paused) — finish ads in Snapchat Ads Manager")); reload(true); } catch (e) { toast.error(e); } finally { setBusy(false); } }
  return <Modal open onClose={onClose} size="lg" title={t("حملات Snapchat الإعلانية", "Snapchat ad campaigns")}>
    {error ? <ErrorBox error={error} onRetry={reload} /> : loading || !data ? <Spinner /> : data.adAccounts.length === 0 ? <p className="text-sm text-subtle">{t("لا توجد حسابات إعلانية مرتبطة بهذا الحساب.", "No ad accounts linked.")}</p> : <div className="space-y-4">
      <select className="input" value={adId || data.adAccountId} onChange={(e) => setAdId(e.target.value)}>{data.adAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select>
      <div className="space-y-1">{data.campaigns.length === 0 ? <p className="text-sm text-subtle">{t("لا توجد حملات", "No campaigns")}</p> : data.campaigns.map((c: any) => <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm"><span className="flex-1">{c.name}</span><Badge>{c.status}</Badge>{c.stats && <span className="text-xs text-subtle">{c.stats.impressions ?? 0} imp · {c.stats.swipes ?? 0} swipes</span>}</div>)}</div>
      <div className="grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-4"><Field label={t("اسم الحملة", "Name")} className="sm:col-span-2"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label={t("البداية", "Start")}><input type="datetime-local" className="input" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field><Field label={t("ميزانية يومية", "Daily budget")}><input type="number" className="input" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></Field>
        <Button className="sm:col-span-4" onClick={create} loading={busy} disabled={!f.name || !f.start}>{t("إنشاء حملة (متوقفة)", "Create campaign (paused)")}</Button></div>
    </div>}
  </Modal>;
}
export default function Page() { return <Suspense><Accounts /></Suspense>; }
