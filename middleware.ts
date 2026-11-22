import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/register", "/mfa", "/unsubscribe", "/api/auth/", "/api/public-media/", "/api/health", "/privacy", "/terms"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // CSRF: state-changing API calls must originate from our own origin (SameSite=Lax cookie + Origin check).
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (!origin || new URL(origin).host !== host) {
      return NextResponse.json({ error: { code: "csrf", message: "طلب مرفوض (CSRF)" } }, { status: 403 });
    }
  }
  if (PUBLIC.some((p) => pathname.startsWith(p)) || pathname.startsWith("/api/")) return NextResponse.next();
  if (!req.cookies.get("ss_session")) {
    const url = req.nextUrl.clone(); url.pathname = "/login"; url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/|favicon.ico|.*\\.(?:png|svg|jpg|ico|webmanifest)$).*)"] };
