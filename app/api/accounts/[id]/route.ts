import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { getAppCreds, PROVIDERS } from "@/lib/integrations";
import type { ProviderId } from "@/lib/integrations/types";

// Disconnect: revoke the token at the provider when supported, wipe tokens, keep history.
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const c = await requireCtx("accounts.connect"); const { id } = await params;
  const a = await db.socialAccount.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: { connection: true } });
  if (a.connection) {
    const others = await db.socialAccount.count({ where: { connectionId: a.connectionId, id: { not: a.id }, status: { not: "disconnected" } } });
    if (others === 0) {
      const p = PROVIDERS[a.connection.provider as ProviderId]; const app = await getAppCreds(c.workspaceId, p.id);
      if (p.revoke && app) await p.revoke({ app, token: decrypt(a.connection.accessTokenEnc) }).catch(() => undefined);
      await db.oAuthConnection.update({ where: { id: a.connection.id }, data: { status: "revoked", accessTokenEnc: "", refreshTokenEnc: null } });
    }
  }
  await db.socialAccount.update({ where: { id }, data: { status: "disconnected", connectionId: null } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "account.disconnect", entityType: "SocialAccount", entityId: id, meta: { platform: a.platform, name: a.displayName } });
  return { ok: true };
});
