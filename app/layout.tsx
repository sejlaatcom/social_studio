import "./globals.css";
import type { Metadata } from "next";
import { getLocale, getTheme } from "@/lib/locale";
import { LocaleProvider } from "@/components/i18n";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = { title: "AI Social Studio — استوديو المحتوى الذكي", description: "من فكرة واحدة إلى محتوى متكامل عبر جميع منصاتك." };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale(); const theme = await getTheme();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={theme === "dark" ? "dark" : ""} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Cairo:wght@400;700;900&family=Tajawal:wght@400;700;900&family=Amiri:wght@400;700&family=Changa:wght@400;700;800&family=Poppins:wght@400;700;900&display=swap" />
        {theme === "system" && <script dangerouslySetInnerHTML={{ __html: `if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')` }} />}
      </head>
      <body className="min-h-screen font-sans">
        <LocaleProvider locale={locale}><ToastProvider>{children}</ToastProvider></LocaleProvider>
      </body>
    </html>
  );
}
