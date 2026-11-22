import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSetting, setSetting, hasSecret, DEFAULT_BRANDING, type BrandingSettings } from "@/lib/settings";
import { getAIConfig, AI_KEYS } from "@/lib/ai/registry";
import { PROVIDERS, getAppCreds, redirectUri } from "@/lib/integrations";
import { getLimits, usage } from "@/lib/plans";
import type { ProviderId } from "@/lib/integrations/types";

export const GET = route(async () => {
  const c = await requireCtx(); const ws = c.workspaceId;
  const keys: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(AI_KEYS)) keys[k] = await hasSecret(ws, v.setting, v.env);
  const integrations = [];
  for (const p of Object.values(PROVIDERS)) {
    const app = await db.integrationApp.findUnique({ where: { workspaceId_provider: { workspaceId: ws, provider: p.id } } });
    const creds = await getAppCreds(ws, p.id);
    const conns = await db.oAuthConnection.findMany({ where: { workspaceId: ws, provider: p.id }, include: { accounts: { select: { id: true, platform: true, displayName: true, status: true, lastSyncAt: true, lastError: true } } } });
    const lastLog = await db.publishingLog.findFirst({ where: { socialAccount: { workspaceId: ws, connection: { provider: p.id } } }, orderBy: { createdAt: "desc" } });
    integrations.push({ id: p.id, name: p.name, platforms: p.platforms, docsUrl: p.docsUrl, redirectUri: redirectUri(p.id), scopes: p.scopesFor(p.platforms[0]), configured: !!creds, source: app ? "workspace" : creds ? "env" : null, clientId: app?.clientId ?? (creds ? creds.clientId.slice(0, 6) + "…" : null),
      connections: conns.map((x) => ({ id: x.id, status: x.status, expiresAt: x.expiresAt, lastError: x.lastError, lastRefreshedAt: x.lastRefreshedAt, scopes: x.scopes, accounts: x.accounts })), lastOperation: lastLog });
  }
  const org = await db.organization.findUnique({ where: { id: c.workspace.organizationId }, include: { plan: true, subscriptions: { orderBy: { createdAt: "desc" }, take: 1 } } });
  return {
    workspace: { name: c.workspace.name, timezone: c.workspace.timezone },
    branding: { ...DEFAULT_BRANDING, ...((await getSetting<BrandingSettings>(ws, "branding")) ?? {}) },
    workflow: { requireApproval: (await getSetting<boolean>(ws, "workflow.requireApproval")) ?? false },
    email: { dailyCap: (await getSetting<number>(ws, "email.dailyCap")) ?? 400 },
    ai: { config: await getAIConfig(ws), keys },
    integrations,
    plan: { plan: org?.plan, subscription: org?.subscriptions[0] ?? null, limits: await getLimits(ws), usage: await usage(ws), plans: await db.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: "asc" } }) },
    storage: { driver: process.env.STORAGE_DRIVER ?? "local" },
    isOwner: c.role.key === "owner",
  };
});

export const PUT = route(async (req) => {
  const c = await requireCtx("settings.manage");
  const b = await body(req, z.object({
    workspaceName: z.string().trim().min(2).max(80).optional(), timezone: z.string().max(60).optional(),
    branding: z.object({ appName: z.string().max(60), appNameAr: z.string().max(60), tagline: z.string().max(200), primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), logoAssetId: z.string().nullish() }).optional(),
    requireApproval: z.boolean().optional(), emailDailyCap: z.number().int().min(1).max(2000).optional(),
  }));
  if (b.workspaceName || b.timezone) await db.workspace.update({ where: { id: c.workspaceId }, data: { ...(b.workspaceName ? { name: b.workspaceName } : {}), ...(b.timezone ? { timezone: b.timezone } : {}) } });
  if (b.branding) await setSetting(c.workspaceId, "branding", b.branding);
  if (b.requireApproval !== undefined) await setSetting(c.workspaceId, "workflow.requireApproval", b.requireApproval);
  if (b.emailDailyCap) await setSetting(c.workspaceId, "email.dailyCap", b.emailDailyCap);
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "settings.update", meta: { keys: Object.keys(b) } });
  return { ok: true };
});
void ({} as ProviderId);
