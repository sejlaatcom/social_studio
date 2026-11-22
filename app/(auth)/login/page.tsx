"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/client";
import { Button, Field, ErrorBox } from "@/components/ui";
import { useT } from "@/components/i18n";

function LoginForm() {
  const t = useT(); const router = useRouter(); const sp = useSearchParams();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState<unknown>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      const r = await api<{ mfaRequired: boolean }>("/api/auth/login", { body: { email, password } });
      const next = sp.get("next") || "/";
      router.replace(r.mfaRequired ? `/mfa?next=${encodeURIComponent(next)}` : next); router.refresh();
    } catch (e) { setError(e); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 animate-in">
      <div><h1 className="text-2xl font-bold">{t("مرحبًا بعودتك", "Welcome back")}</h1><p className="mt-1 text-sm text-subtle">{t("سجّل الدخول لإدارة محتواك", "Sign in to manage your content")}</p></div>
      {error ? <ErrorBox error={error} /> : null}
      <Field label={t("البريد الإلكتروني", "Email")}><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></Field>
      <Field label={t("كلمة المرور", "Password")}><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></Field>
      <Button className="w-full" loading={loading}>{t("تسجيل الدخول", "Sign in")}</Button>
      <p className="text-center text-sm text-subtle">{t("ليس لديك حساب؟", "No account?")} <Link href="/register" className="font-medium text-primary">{t("أنشئ حسابًا", "Create one")}</Link></p>
    </form>
  );
}
export default function Page() { return <Suspense><LoginForm /></Suspense>; }
