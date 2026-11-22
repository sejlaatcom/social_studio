import { z } from "zod";
import { cookies } from "next/headers";
import { route, body } from "@/lib/api";
import { db } from "@/lib/db";
import { getUser, WS_COOKIE } from "@/lib/auth";
import { forbidden } from "@/lib/errors";

// Locale/theme/workspace switch (cookies; persisted on user when signed in)
export const POST = route(async (req) => {
  const b = await body(req, z.object({ locale: z.enum(["ar", "en"]).optional(), theme: z.enum(["light", "dark", "system"]).optional(), workspaceId: z.string().optional() }));
  const c = await cookies(); const user = await getUser();
  const opts = { path: "/", sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 365 };
  if (b.locale) c.set("ss_locale", b.locale, opts);
  if (b.theme) c.set("ss_theme", b.theme, opts);
  if (user && (b.locale || b.theme)) await db.user.update({ where: { id: user.id }, data: { ...(b.locale ? { locale: b.locale } : {}), ...(b.theme ? { theme: b.theme } : {}) } });
  if (b.workspaceId) {
    if (!user || !(await db.membership.findUnique({ where: { userId_workspaceId: { userId: user.id, workspaceId: b.workspaceId } } }))) throw forbidden();
    c.set(WS_COOKIE, b.workspaceId, { ...opts, httpOnly: true });
  }
  return { ok: true };
});
