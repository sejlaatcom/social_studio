import { z } from "zod";
import bcrypt from "bcryptjs";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";
export const POST = route(async (req) => {
  const c = await requireCtx();
  const b = await body(req, z.object({ current: z.string(), next: z.string().min(10).max(200) }));
  const u = await db.user.findUniqueOrThrow({ where: { id: c.user.id } });
  if (!(await bcrypt.compare(b.current, u.passwordHash))) throw badRequest("كلمة المرور الحالية غير صحيحة");
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(b.next, 12) } });
  await audit({ workspaceId: c.workspaceId, userId: u.id, action: "auth.password_change" });
  return { ok: true };
});
