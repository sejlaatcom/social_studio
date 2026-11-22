"use client";
import Link from "next/link";
import { CheckCircle2, Circle, Gem, Bot, Plug, Sparkles, Rocket } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT } from "@/components/i18n";
import { Card, PageHeader, SkeletonList } from "@/components/ui";

export default function Onboarding() {
  const t = useT();
  const { data: s } = useApi<any>("/api/settings"); const { data: kits } = useApi<any[]>("/api/brand-kits"); const { data: acc } = useApi<any>("/api/accounts");
  if (!s || !kits || !acc) return <SkeletonList />;
  const steps = [
    { done: kits.length > 0, icon: Gem, href: "/brand", title: t("أنشئ هويتك التجارية", "Create your brand kit"), body: t("الاسم، الألوان، الخطوط، النبرة والجمهور — يستخدمها الذكاء الاصطناعي تلقائيًا.", "Name, colors, fonts, tone and audience — used automatically by AI.") },
    { done: s.ai.keys[s.ai.config.llm.provider], icon: Bot, href: "/settings?tab=ai", title: t("فعّل الذكاء الاصطناعي", "Enable AI"), body: t("أضف مفتاح Anthropic (للنصوص) وOpenAI (للصور والصوت).", "Add an Anthropic key (text) and OpenAI key (images & voice).") },
    { done: s.integrations.some((i: any) => i.configured), icon: Plug, href: "/settings?tab=integrations", title: t("أعدّ تطبيقات المطورين", "Configure developer apps"), body: t("Client ID/Secret لكل منصة تريد ربطها (Google، Meta، X، TikTok، Snapchat).", "Client ID/Secret for each platform (Google, Meta, X, TikTok, Snapchat).") },
    { done: acc.accounts.length > 0, icon: Plug, href: "/accounts", title: t("اربط حساباتك", "Connect your accounts"), body: t("عبر OAuth الرسمي لكل منصة.", "Via each platform's official OAuth.") },
    { done: false, icon: Sparkles, href: "/studio", title: t("اصنع أول محتوى", "Create your first content"), body: t("فكرة واحدة ← محتوى لكل المنصات.", "One idea → content for every platform.") },
  ];
  return <div className="mx-auto max-w-2xl">
    <PageHeader icon={<Rocket />} title={t("مرحبًا بك! لنبدأ", "Welcome! Let's get started")} subtitle={t("خطوات قليلة لتجهيز منصتك", "A few steps to set up your workspace")} />
    <div className="space-y-3">{steps.map((st, i) => <Link key={i} href={st.href}><Card className="flex items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><st.icon className="h-5 w-5" /></div>
      <div className="flex-1"><h3 className="font-semibold">{i + 1}. {st.title}</h3><p className="text-sm text-subtle">{st.body}</p></div>
      {st.done ? <CheckCircle2 className="h-6 w-6 text-success" /> : <Circle className="h-6 w-6 text-border" />}</Card></Link>)}</div>
  </div>;
}
