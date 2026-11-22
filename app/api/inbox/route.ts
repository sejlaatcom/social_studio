import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLATFORM_INFO, type Platform } from "@/lib/platforms";
import { PUBLISHERS } from "@/lib/integrations";
import type { Prisma } from "@prisma/client";

export const GET = route(async (req) => {
  const c = await requireCtx(); const sp = new URL(req.url).searchParams;
  const accounts = await db.socialAccount.findMany({ where: { workspaceId: c.workspaceId, status: { not: "disconnected" } }, select: { id: true, platform: true, displayName: true, status: true } });
  // A channel is listed as integrated only if the platform's publisher actually implements comment fetching.
  const channels = accounts.map((a) => ({ ...a, comments: !!PUBLISHERS[a.platform as Platform].fetchComments && PLATFORM_INFO[a.platform as Platform].capabilities.comments.supported, reply: !!PUBLISHERS[a.platform as Platform].replyComment, messages: PLATFORM_INFO[a.platform as Platform].capabilities.messages.supported }));
  const where: Prisma.CommentWhereInput = { workspaceId: c.workspaceId };
  if (sp.get("status")) where.status = sp.get("status")!;
  if (sp.get("category")) where.category = sp.get("category")!;
  if (sp.get("priority")) where.priority = sp.get("priority")!;
  if (sp.get("accountId")) where.socialAccountId = sp.get("accountId")!;
  const items = await db.comment.findMany({ where, orderBy: { postedAt: "desc" }, take: 200, include: { socialAccount: { select: { platform: true, displayName: true } } } });
  return { channels, items };
});
