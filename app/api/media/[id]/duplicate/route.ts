import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { saveAsset } from "@/lib/media";

export const POST = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("media.manage"); const { id } = await params;
  const a = await db.mediaAsset.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  return saveAsset({ workspaceId: c.workspaceId, userId: c.user.id, name: a.name.replace(/(\.\w+)?$/, " (نسخة)$1"), data: await storage().get(a.storageKey), mimeType: a.mimeType, kind: a.kind, tags: a.tags, platforms: a.platforms, source: a.source, campaignId: a.campaignId, projectId: a.projectId });
});
