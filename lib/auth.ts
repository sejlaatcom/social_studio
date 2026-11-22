import { cookies, headers } from "next/headers";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";
import { forbidden, unauthorized } from "./errors";
import type { PermissionKey } from "./permissions";

export const SESSION_COOKIE = "ss_session";
export const WS_COOKIE = "ss_ws";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export async function createSession(userId: string, mfaPassed: boolean) {
  const token = randomToken();
  const h = await headers();
  await db.session.create({
    data: {
      tokenHash: sha256(token), userId, mfaPassed,
      ip: h.get("x-forwarded-for")?.split(",")[0] ?? null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.APP_URL?.startsWith("https://") ?? false,
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  c.delete(SESSION_COOKIE);
}

export async function getSession() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return s;
}

/** Returns the signed-in user (full session incl. MFA) or null. */
export async function getUser() {
  const s = await getSession();
  if (!s) return null;
  if (s.user.mfaEnabled && !s.mfaPassed) return null;
  return s.user;
}

export type Ctx = Awaited<ReturnType<typeof requireCtx>>;

/** Loads user + active workspace + permissions. Throws AppError when unauthenticated. */
export async function requireCtx(perm?: PermissionKey) {
  const user = await getUser();
  if (!user) throw unauthorized();
  const c = await cookies();
  const wsId = c.get(WS_COOKIE)?.value;
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { workspace: { include: { organization: { include: { plan: true } } } }, role: { include: { permissions: { include: { permission: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) throw forbidden("لا توجد مساحة عمل مرتبطة بحسابك");
  const m = memberships.find((x) => x.workspaceId === wsId) ?? memberships[0];
  const perms = new Set(m.role.permissions.map((p) => p.permission.key as PermissionKey));
  if (perm && !perms.has(perm)) throw forbidden();
  return {
    user, workspace: m.workspace, workspaceId: m.workspaceId, role: m.role, perms,
    memberships: memberships.map((x) => ({ id: x.workspaceId, name: x.workspace.name, role: x.role.nameAr })),
    can: (p: PermissionKey) => perms.has(p),
  };
}
