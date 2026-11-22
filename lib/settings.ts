import { db } from "./db";
import { decrypt, encrypt } from "./crypto";

export async function getSetting<T = unknown>(workspaceId: string, key: string): Promise<T | null> {
  const s = await db.setting.findUnique({ where: { workspaceId_key: { workspaceId, key } } });
  return (s?.value as T) ?? null;
}
export async function setSetting(workspaceId: string, key: string, value: unknown) {
  await db.setting.upsert({
    where: { workspaceId_key: { workspaceId, key } },
    create: { workspaceId, key, value: value as object },
    update: { value: value as object },
  });
}
/** Secrets are stored AES-GCM encrypted and are never returned to the browser. */
export async function getSecret(workspaceId: string, key: string, envFallback?: string): Promise<string | null> {
  const s = await db.setting.findUnique({ where: { workspaceId_key: { workspaceId, key } } });
  if (s?.secretEnc) return decrypt(s.secretEnc);
  return envFallback ? process.env[envFallback] ?? null : null;
}
export async function setSecret(workspaceId: string, key: string, value: string | null) {
  await db.setting.upsert({
    where: { workspaceId_key: { workspaceId, key } },
    create: { workspaceId, key, secretEnc: value ? encrypt(value) : null },
    update: { secretEnc: value ? encrypt(value) : null },
  });
}
export async function hasSecret(workspaceId: string, key: string, envFallback?: string) {
  return (await getSecret(workspaceId, key, envFallback)) !== null;
}

export type BrandingSettings = { appName: string; appNameAr: string; tagline: string; primaryColor: string; logoAssetId?: string | null };
export const DEFAULT_BRANDING: BrandingSettings = {
  appName: "AI Social Studio", appNameAr: "استوديو المحتوى الذكي",
  tagline: "من فكرة واحدة إلى محتوى متكامل عبر جميع منصاتك.", primaryColor: "#6d5dfc",
};
