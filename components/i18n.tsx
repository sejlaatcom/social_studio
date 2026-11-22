"use client";
import { createContext, useContext } from "react";

export type Locale = "ar" | "en";
const Ctx = createContext<Locale>("ar");
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}
export function useLocale() { return useContext(Ctx); }
/** Inline bilingual strings: t("نص", "Text"). Keeps Arabic first-class without a giant key file. */
export function useT() {
  const l = useContext(Ctx);
  return (ar: string, en: string) => (l === "ar" ? ar : en);
}
