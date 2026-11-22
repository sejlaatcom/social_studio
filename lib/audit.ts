import { headers } from "next/headers";
import { db } from "./db";

export async function audit(opts: { workspaceId?: string | null; userId?: string | null; action: string; entityType?: string; entityId?: string; meta?: Record<string, unknown> }) {
  let ip: string | null = null;
  try { ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? null; } catch { /* outside request (worker) */ }
  await db.auditLog.create({
    data: { workspaceId: opts.workspaceId ?? null, userId: opts.userId ?? null, action: opts.action, entityType: opts.entityType, entityId: opts.entityId, meta: (opts.meta ?? undefined) as object | undefined, ip },
  });
}
