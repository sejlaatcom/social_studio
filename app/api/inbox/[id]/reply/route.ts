import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getAccessToken, PUBLISHERS } from "@/lib/integrations";
import { badRequest, AppError } from "@/lib/errors";
import type { Platform } from "@/lib/platforms";

// Replies through the platform API; marked "replied" only after the API call succeeds.
export const POST = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("inbox.manage"); const { id } = await params;
  const { text } = await body(req, z.object({ text: z.string().trim().min(1).max(2200) }));
  const cm = await db.comment.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: { socialAccount: true } });
  const pub = PUBLISHERS[cm.socialAccount.platform as Platform];
  if (!pub.replyComment) throw badRequest("الرد غير مدعوم عبر API لهذه المنصة");
  try { const { token } = await getAccessToken(cm.socialAccountId); await pub.replyComment({ accessToken: token, commentId: cm.externalId, text }); }
  catch (e) { throw new AppError(502, "platform_error", (e as Error).message); }
  await db.comment.update({ where: { id }, data: { status: "replied", replyText: text, repliedAt: new Date() } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "inbox.reply", entityType: "Comment", entityId: id });
  return { ok: true };
});
