"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/client";
import { Button, ErrorBox } from "@/components/ui";
import { useT } from "@/components/i18n";

function MfaForm() {
  const t = useT(); const router = useRouter(); const sp = useSearchParams();
  const [code, setCode] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState<unknown>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try { await api("/api/auth/mfa", { body: { code } }); router.replace(sp.get("next") || "/"); router.refresh(); }
    catch (e) { setError(e); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 text-center animate-in">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck /></div>
      <h1 className="text-2xl font-bold">{t("التحقق بخطوتين", "Two-factor verification")}</h1>
      <p className="text-sm text-subtle">{t("أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة", "Enter the 6-digit code from your authenticator app")}</p>
      {error ? <ErrorBox error={error} /> : null}
      <input className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} dir="ltr" autoFocus />
      <Button className="w-full" loading={loading}>{t("تحقق", "Verify")}</Button>
    </form>
  );
}
export default function Page() { return <Suspense><MfaForm /></Suspense>; }
