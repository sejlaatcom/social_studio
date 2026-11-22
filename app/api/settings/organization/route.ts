import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx, destroySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { decrypt } from "@/lib/crypto";
import { getAppCreds, PROVIDERS } from "@/lib/integrations";
import { forbidden, badRequest } from "@/lib/errors";
import type { ProviderId } from "@/lib/integrations/types";

// Permanently deletes the organization: revokes OAuth tokens, removes files from storage and all DB data.
export const DELETE = route(async (req) => {
  const c = await requireCtx();
  if (c.role.key !== "owner") throw forbidden("فقط مالك المنصة يمكنه حذف المؤسسة");
  const b = await body(req, z.object({ confirm: z.string() }));
  if (b.confirm !== c.workspace.name) throw badRequest("اكتب اسم مساحة العمل للتأكيد");
  const orgId = c.workspace.organizationId;
  const wss = await db.workspace.findMany({ where: { organizationId: orgId } });
  for (const ws of wss) {
    for (const conn of await db.oAuthConnection.findMany({ where: { workspaceId: ws.id, status: "active" } })) {
      const app = await getAppCreds(ws.id, conn.provider as ProviderId); const p = PROVIDERS[conn.provider as ProviderId];
      if (app && p.revoke && conn.accessTokenEnc) await p.revoke({ app, token: decrypt(conn.accessTokenEnc) }).catch(() => undefined);
    }
    for (const a of await db.mediaAsset.findMany({ where: { workspaceId: ws.id }, select: { storageKey: true } })) await storage().delete(a.storageKey).catch(() => undefined);
  }
  const users = await db.membership.findMany({ where: { workspace: { organizationId: orgId } }, select: { userId: true } });
  await db.organization.delete({ where: { id: orgId } });
  // remove users that no longer belong to any workspace
  for (const u of users) if ((await db.membership.count({ where: { userId: u.userId } })) === 0) await db.user.delete({ where: { id: u.userId } }).catch(() => undefined);
  await destroySession();
  return { ok: true };
});
