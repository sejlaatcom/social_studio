"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, Field, ErrorBox } from "@/components/ui";
import { useT } from "@/components/i18n";

export default function Register() {
  const t = useT(); const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", organization: "" });
  const [loading, setLoading] = useState(false); const [error, setError] = useState<unknown>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try { await api("/api/auth/register", { body: f }); router.replace("/onboarding"); router.refresh(); }
    catch (e) { setError(e); } finally { setLoading(false); }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 animate-in">
      <div><h1 className="text-2xl font-bold">{t("أنشئ حسابك", "Create your account")}</h1><p className="mt-1 text-sm text-subtle">{t("ابدأ في دقائق", "Get started in minutes")}</p></div>
      {error ? <ErrorBox error={error} /> : null}
      <Field label={t("الاسم", "Name")}><input className="input" required value={f.name} onChange={set("name")} /></Field>
      <Field label={t("اسم الشركة أو العلامة", "Company / brand")}><input className="input" required value={f.organization} onChange={set("organization")} /></Field>
      <Field label={t("البريد الإلكتروني", "Email")}><input className="input" type="email" required value={f.email} onChange={set("email")} dir="ltr" /></Field>
      <Field label={t("كلمة المرور", "Password")} hint={t("10 أحرف على الأقل", "At least 10 characters")}><input className="input" type="password" minLength={10} required value={f.password} onChange={set("password")} dir="ltr" autoComplete="new-password" /></Field>
      <Button className="w-full" loading={loading}>{t("إنشاء الحساب", "Create account")}</Button>
      <p className="text-center text-sm text-subtle">{t("لديك حساب؟", "Have an account?")} <Link href="/login" className="font-medium text-primary">{t("سجّل الدخول", "Sign in")}</Link></p>
    </form>
  );
}
