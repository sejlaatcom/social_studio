import type { z } from "zod";
import { db } from "@/lib/db";
import type { PostSchema } from "./schema";

/** Writes post + variants + media in one transaction (variants replaced by id/platform). */
export async function savePost(workspaceId: string, userId: string, data: z.infer<typeof PostSchema>, postId?: string) {
  const assetIds = [...data.media.map((m) => m.assetId), ...data.variants.flatMap((v) => v.media?.map((m) => m.assetId) ?? [])];
  const valid = new Set((await db.mediaAsset.findMany({ where: { id: { in: assetIds }, workspaceId }, select: { id: true } })).map((a) => a.id));
  const accountIds = data.variants.map((v) => v.socialAccountId).filter(Boolean) as string[];
  const accs = new Set((await db.socialAccount.findMany({ where: { id: { in: accountIds }, workspaceId }, select: { id: true } })).map((a) => a.id));
  return db.$transaction(async (tx) => {
    const base = { title: data.title, body: data.body, contentType: data.contentType ?? null, projectId: data.projectId ?? null, ideaId: data.ideaId ?? null, ...(data.status ? { status: data.status } : {}) };
    const post = postId ? await tx.post.update({ where: { id: postId }, data: base }) : await tx.post.create({ data: { ...base, workspaceId, authorId: userId, status: data.status ?? "draft", scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null } });
    if (data.campaignId) await tx.campaignPost.upsert({ where: { campaignId_postId: { campaignId: data.campaignId, postId: post.id } }, create: { campaignId: data.campaignId, postId: post.id }, update: {} });
    await tx.postMedia.deleteMany({ where: { postId: post.id } });
    await tx.postMedia.createMany({ data: data.media.filter((m) => valid.has(m.assetId)).map((m, i) => ({ postId: post.id, assetId: m.assetId, altText: m.altText ?? null, order: i })) });
    const existing = await tx.postVariant.findMany({ where: { postId: post.id } });
    const keep = new Set<string>();
    for (const v of data.variants) {
      const prev = existing.find((e) => e.id === v.id) ?? existing.find((e) => e.platform === v.platform && !keep.has(e.id) && (e.socialAccountId === (v.socialAccountId ?? null)));
      const fields = { platform: v.platform, socialAccountId: v.socialAccountId && accs.has(v.socialAccountId) ? v.socialAccountId : null, format: v.format, text: v.text, title: v.title ?? null, hashtags: v.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)), threadParts: v.threadParts, pollOptions: v.pollOptions, options: (v.options ?? undefined) as object | undefined };
      const row = prev ? await tx.postVariant.update({ where: { id: prev.id }, data: prev.status === "published" ? {} : fields }) : await tx.postVariant.create({ data: { ...fields, postId: post.id } });
      keep.add(row.id);
      if (v.media && prev?.status !== "published") {
        await tx.postMedia.deleteMany({ where: { variantId: row.id } });
        await tx.postMedia.createMany({ data: v.media.filter((m) => valid.has(m.assetId)).map((m, i) => ({ postId: post.id, variantId: row.id, assetId: m.assetId, altText: m.altText ?? null, order: i })) });
      }
    }
    const remove = existing.filter((e) => !keep.has(e.id) && e.status !== "published").map((e) => e.id);
    if (remove.length) await tx.postVariant.deleteMany({ where: { id: { in: remove } } });
    return post;
  });
}
