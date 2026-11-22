import { z } from "zod";
import { db } from "@/lib/db";
import { route, body } from "@/lib/api";
import { getSession, requireCtx } from "@/lib/auth";
import { decrypt, encrypt, generateTotpSecret, verifyTotp } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { AppError, unauthorized, badRequest } from "@/lib/errors";
import QRCode from "qrcode";

// POST {code} — completes login MFA challenge
export const POST = route(async (req) => {
  const s = await getSession(); if (!s) throw unauthorized();
  await rateLimit(`mfa:${s.userId}`, 10, 900);
  const { code } = await body(req, z.object({ code: z.string().min(6).max(8) }));
  if (!s.user.mfaSecretEnc || !verifyTotp(decrypt(s.user.mfaSecretEnc), code)) throw new AppError(401, "invalid_code", "الرمز غير صحيح");
  await db.session.update({ where: { id: s.id }, data: { mfaPassed: true } });
  return { ok: true };
});

// PUT {action:"setup"} → returns QR; {action:"enable", code} ; {action:"disable", code}
export const PUT = route(async (req) => {
  const ctx = await requireCtx();
  const b = await body(req, z.object({ action: z.enum(["setup", "enable", "disable"]), code: z.string().optional() }));
  const user = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (b.action === "setup") {
    const secret = generateTotpSecret();
    await db.user.update({ where: { id: user.id }, data: { mfaSecretEnc: encrypt(secret), mfaEnabled: false } });
    const uri = `otpauth://totp/AI%20Social%20Studio:${encodeURIComponent(user.email)}?secret=${secret}&issuer=AI%20Social%20Studio`;
    return { secret, qr: await QRCode.toDataURL(uri) };
  }
  if (!user.mfaSecretEnc || !b.code || !verifyTotp(decrypt(user.mfaSecretEnc), b.code)) throw badRequest("الرمز غير صحيح");
  await db.user.update({ where: { id: user.id }, data: b.action === "enable" ? { mfaEnabled: true } : { mfaEnabled: false, mfaSecretEnc: null } });
  if (b.action === "enable") await db.session.updateMany({ where: { userId: user.id }, data: { mfaPassed: true } });
  await audit({ workspaceId: ctx.workspaceId, userId: user.id, action: `auth.mfa_${b.action}` });
  return { ok: true };
});
