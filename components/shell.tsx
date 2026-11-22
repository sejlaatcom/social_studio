"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Bot, Sparkles, Palette, Clapperboard, Users2, Send, CalendarDays, Megaphone, FolderOpen, Inbox, BarChart3, Gem, Users, Settings, Bell, Moon, Sun, Languages, LogOut, Menu, X, Lightbulb, Mail, ChevronDown, Building2 } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/client";
import { useT, useLocale } from "./i18n";
import { createContext, useContext } from "react";

const PermCtx = createContext<string[]>([]);
export const usePerms = () => { const p = useContext(PermCtx); return (k: string) => p.includes(k); };

type NavItem = { href: string; ar: string; en: string; icon: React.ElementType; sub?: boolean };
const NAV: NavItem[] = [
  { href: "/", ar: "الرئيسية", en: "Home", icon: LayoutDashboard },
  { href: "/assistant", ar: "المساعد الذكي", en: "AI Assistant", icon: Bot },
  { href: "/studio", ar: "صناعة المحتوى", en: "Content Studio", icon: Sparkles },
  { href: "/ideas", ar: "بنك الأفكار", en: "Ideas", icon: Lightbulb, sub: true },
  { href: "/design", ar: "استوديو التصميم", en: "Design Studio", icon: Palette },
  { href: "/video", ar: "استوديو الفيديو", en: "Video Studio", icon: Clapperboard },
  { href: "/accounts", ar: "الحسابات", en: "Accounts", icon: Users2 },
  { href: "/posts", ar: "المنشورات", en: "Posts", icon: Send },
  { href: "/calendar", ar: "التقويم", en: "Calendar", icon: CalendarDays },
  { href: "/campaigns", ar: "الحملات", en: "Campaigns", icon: Megaphone },
  { href: "/email", ar: "الحملات البريدية", en: "Email campaigns", icon: Mail, sub: true },
  { href: "/media", ar: "مكتبة الملفات", en: "Media Library", icon: FolderOpen },
  { href: "/inbox", ar: "الرسائل والتعليقات", en: "Inbox", icon: Inbox },
  { href: "/analytics", ar: "التحليلات", en: "Analytics", icon: BarChart3 },
  { href: "/brand", ar: "الهوية التجارية", en: "Brand Kit", icon: Gem },
  { href: "/users", ar: "المستخدمون", en: "Users", icon: Users },
  { href: "/settings", ar: "الإعدادات", en: "Settings", icon: Settings },
];

type Notif = { id: string; title: string; body?: string; link?: string; readAt: string | null; createdAt: string; type: string };

export function Shell({ children, user, workspace, memberships, perms, branding }: { children: React.ReactNode; user: { name: string; email: string }; workspace: { id: string; name: string }; memberships: { id: string; name: string; role: string }[]; perms: string[]; branding: { appName: string; appNameAr: string } }) {
  const t = useT(); const locale = useLocale(); const path = usePathname(); const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<{ items: Notif[]; unread: number }>({ items: [], unread: 0 });
  const [nOpen, setNOpen] = useState(false); const [uOpen, setUOpen] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    let alive = true;
    const load = () => api<{ items: Notif[]; unread: number }>("/api/notifications").then((d) => alive && setNotifs(d)).catch(() => {});
    load(); const i = setInterval(load, 30000); return () => { alive = false; clearInterval(i); };
  }, []);

  async function pref(b: Record<string, string>) { await api("/api/auth/preferences", { body: b }); router.refresh(); }
  function toggleTheme() { const d = !dark; setDark(d); document.documentElement.classList.toggle("dark", d); void api("/api/auth/preferences", { body: { theme: d ? "dark" : "light" } }); }
  async function markAll() { await api("/api/notifications", { method: "PATCH", body: { all: true } }); setNotifs((n) => ({ items: n.items.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })), unread: 0 })); }

  const name = locale === "ar" ? branding.appNameAr : branding.appName;
  const active = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/"));

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-lg shadow-primary/30"><Sparkles className="h-5 w-5" /></div>
        <div className="min-w-0"><div className="truncate text-sm font-bold">{name}</div><div className="truncate text-[11px] text-subtle">{workspace.name}</div></div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={clsx("group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition", n.sub && "ms-5 py-1.5 text-[13px]", active(n.href) ? "bg-primary/10 font-medium text-primary" : "text-subtle hover:bg-muted hover:text-fg")}>
            <n.icon className={clsx("shrink-0 transition group-hover:scale-110", n.sub ? "h-3.5 w-3.5" : "h-[18px] w-[18px]")} />{t(n.ar, n.en)}
          </Link>
        ))}
      </div>
      {memberships.length > 1 && (
        <div className="border-t border-border p-3">
          <label className="label flex items-center gap-1"><Building2 className="h-3 w-3" />{t("مساحة العمل", "Workspace")}</label>
          <select className="input py-1.5" value={workspace.id} onChange={(e) => pref({ workspaceId: e.target.value })}>{memberships.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        </div>
      )}
    </nav>
  );

  return (
    <PermCtx.Provider value={perms}>
      <div className="min-h-screen lg:ps-64">
        <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e border-border bg-surface lg:block">{sidebar}</aside>
        {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)}><aside className="h-full w-72 bg-surface shadow-pop animate-in" onClick={(e) => e.stopPropagation()}>{sidebar}</aside></div>}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-bg/80 px-4 backdrop-blur-md sm:px-6">
          <button className="btn-ghost h-9 w-9 p-0 lg:hidden" onClick={() => setOpen(true)} aria-label="menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <div className="flex-1" />
          <button className="btn-ghost h-9 px-2.5" onClick={() => pref({ locale: locale === "ar" ? "en" : "ar" })} title="Language"><Languages className="h-4 w-4" /><span className="text-xs">{locale === "ar" ? "EN" : "ع"}</span></button>
          <button className="btn-ghost h-9 w-9 p-0" onClick={toggleTheme} aria-label="theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          <div className="relative">
            <button className="btn-ghost relative h-9 w-9 p-0" onClick={() => setNOpen(!nOpen)} aria-label="notifications">
              <Bell className="h-4 w-4" />{notifs.unread > 0 && <span className="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-white">{notifs.unread > 9 ? "9+" : notifs.unread}</span>}
            </button>
            {nOpen && (
              <div className="card absolute end-0 top-11 z-30 w-[min(92vw,380px)] shadow-pop animate-in" onMouseLeave={() => setNOpen(false)}>
                <div className="flex items-center justify-between border-b border-border px-4 py-3"><span className="text-sm font-semibold">{t("الإشعارات", "Notifications")}</span>{notifs.unread > 0 && <button className="text-xs text-primary" onClick={markAll}>{t("تحديد الكل كمقروء", "Mark all read")}</button>}</div>
                <div className="max-h-96 overflow-y-auto">
                  {notifs.items.length === 0 ? <p className="p-6 text-center text-sm text-subtle">{t("لا توجد إشعارات", "No notifications")}</p> :
                    notifs.items.map((n) => (
                      <Link key={n.id} href={n.link ?? "#"} onClick={() => { setNOpen(false); if (!n.readAt) void api("/api/notifications", { method: "PATCH", body: { id: n.id } }); }} className={clsx("block border-b border-border px-4 py-3 text-sm last:border-0 hover:bg-muted", !n.readAt && "bg-primary/5")}>
                        <div className="font-medium leading-6">{n.title}</div>{n.body && <div className="line-clamp-2 text-xs text-subtle">{n.body}</div>}
                        <div className="mt-1 text-[11px] text-subtle">{new Date(n.createdAt).toLocaleString(locale === "ar" ? "ar" : "en")}</div>
                      </Link>))}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted" onClick={() => setUOpen(!uOpen)}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-sm font-bold text-white">{user.name.slice(0, 1)}</span>
              <span className="hidden text-sm sm:block">{user.name}</span><ChevronDown className="hidden h-3 w-3 text-subtle sm:block" />
            </button>
            {uOpen && (
              <div className="card absolute end-0 top-12 z-30 w-56 p-1.5 shadow-pop animate-in" onMouseLeave={() => setUOpen(false)}>
                <div className="px-3 py-2 text-xs text-subtle" dir="ltr">{user.email}</div>
                <Link href="/settings?tab=security" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"><Settings className="h-4 w-4" />{t("الأمان والحساب", "Security & account")}</Link>
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); router.replace("/login"); }}><LogOut className="h-4 w-4" />{t("تسجيل الخروج", "Sign out")}</button>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </PermCtx.Provider>
  );
}
