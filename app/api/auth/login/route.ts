import bcrypt from "bcryptjs";
import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { route, body } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

const S = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

export const POST = route(async (req) => {
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  const b = await body(req, S);
  await rateLimit(`login:${ip}`, 20, 900);
  await rateLimit(`login:${b.email}`, 10, 900);
  const user = await db.user.findUnique({ where: { email: b.email } });
  const ok = user && (await bcrypt.compare(b.password, user.passwordHash));
  if (!user || !ok) { await audit({ userId: user?.id, action: "auth.login_failed", meta: { email: b.email } }); throw new AppError(401, "invalid_credentials", "البريد الإلكتروني أو كلمة المرور غير صحيحة"); }
  await createSession(user.id, !user.mfaEnabled);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ userId: user.id, action: "auth.login" });
  return { mfaRequired: user.mfaEnabled };
});
