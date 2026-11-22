import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { savePost } from "../../save";

export const POST = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("content.create"); const { id } = await params;
  const p = await db.post.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: { variants: { include: { media: true } }, media: { where: { variantId: null } } } });
  return savePost(c.workspaceId, c.user.id, {
    title: `${p.title} (نسخة)`, body: p.body, status: "draft", contentType: p.contentType, projectId: p.projectId,
    media: p.media.map((m) => ({ assetId: m.assetId, altText: m.altText })),
    variants: p.variants.map((v) => ({ platform: v.platform as "x", socialAccountId: v.socialAccountId, format: v.format as "post", text: v.text, title: v.title, hashtags: v.hashtags, threadParts: v.threadParts, pollOptions: v.pollOptions, options: v.options as Record<string, unknown> | null, media: v.media.map((m) => ({ assetId: m.assetId, altText: m.altText })) })),
  });
});
