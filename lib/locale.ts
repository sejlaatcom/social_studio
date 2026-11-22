import { cookies } from "next/headers";
export async function getLocale(): Promise<"ar" | "en"> {
  return (await cookies()).get("ss_locale")?.value === "en" ? "en" : "ar";
}
export async function getTheme(): Promise<"light" | "dark" | "system"> {
  const t = (await cookies()).get("ss_theme")?.value;
  return t === "light" || t === "dark" ? t : "system";
}
