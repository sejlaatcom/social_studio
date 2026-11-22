import bcrypt from "bcryptjs";
import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { route, body } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { createOrganization } from "@/lib/tenancy";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { conflict } from "@/lib/errors";

const S = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), password: z.string().min(10).max(200), organization: z.string().trim().min(2).max(80) });

export const POST = route(async (req) => {
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  await rateLimit(`register:${ip}`, 5, 3600);
  const b = await body(req, S);
  if (await db.user.findUnique({ where: { email: b.email } })) throw conflict("البريد الإلكتروني مسجل مسبقًا");
  const isFirst = (await db.user.count()) === 0;
  const user = await db.user.create({ data: { email: b.email, name: b.name, passwordHash: await bcrypt.hash(b.password, 12), isSuperAdmin: isFirst } });
  const { ws } = await createOrganization(user.id, b.organization);
  await createSession(user.id, true);
  await audit({ workspaceId: ws.id, userId: user.id, action: "auth.register" });
  return { ok: true };
});
