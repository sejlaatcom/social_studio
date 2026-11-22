import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
export const GET = route(async (req) => {
  const c = await requireCtx("settings.manage"); const sp = new URL(req.url).searchParams;
  return db.auditLog.findMany({ where: { workspaceId: c.workspaceId, ...(sp.get("action") ? { action: { startsWith: sp.get("action")! } } : {}) }, orderBy: { createdAt: "desc" }, take: 100, skip: Number(sp.get("skip") ?? 0), include: { user: { select: { name: true, email: true } } } });
});
