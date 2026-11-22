import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { PROVIDERS } from "@/lib/integrations";
import { badRequest } from "@/lib/errors";
import type { ProviderId } from "@/lib/integrations/types";

export const PUT = route<{ provider: string }>(async (req, { params }) => {
  const c = await requireCtx("settings.manage"); const { provider } = await params;
  if (!PROVIDERS[provider as ProviderId]) throw badRequest("مزود غير معروف");
  const b = await body(req, z.object({ clientId: z.string().trim().min(3).max(300), clientSecret: z.string().trim().min(3).max(500) }));
  await db.integrationApp.upsert({ where: { workspaceId_provider: { workspaceId: c.workspaceId, provider } }, create: { workspaceId: c.workspaceId, provider, clientId: b.clientId, clientSecretEnc: encrypt(b.clientSecret) }, update: { clientId: b.clientId, clientSecretEnc: encrypt(b.clientSecret) } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "integration.app_update", meta: { provider } });
  return { ok: true };
});
export const DELETE = route<{ provider: string }>(async (_r, { params }) => {
  const c = await requireCtx("settings.manage"); const { provider } = await params;
  await db.integrationApp.deleteMany({ where: { workspaceId: c.workspaceId, provider } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "integration.app_delete", meta: { provider } });
  return { ok: true };
});
