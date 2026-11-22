import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { videoScript } from "@/lib/ai/service";
import { checkLimit } from "@/lib/plans";

export const maxDuration = 300;
export const GET = route(async () => {
  const c = await requireCtx();
  return db.videoProject.findMany({ where: { workspaceId: c.workspaceId }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { scenes: true } } } });
});
export const POST = route(async (req) => {
  const c = await requireCtx("content.create");
  const b = await body(req, z.object({ title: z.string().max(200).optional(), topic: z.string().min(3).max(5000), videoType: z.string().max(30).default("marketing"), aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
    language: z.enum(["ar", "en"]).default("ar"), dialect: z.string().optional(), durationSec: z.number().int().min(10).max(1200).default(45), sourceText: z.string().max(50000).optional(),
    imageAssetIds: z.array(z.string()).max(60).optional(), generateScript: z.boolean().default(true) }));
  await checkLimit(c.workspaceId, "videos");
  const v = await db.videoProject.create({ data: { workspaceId: c.workspaceId, title: b.title || b.topic.slice(0, 80), topic: b.topic, videoType: b.videoType, aspectRatio: b.aspectRatio, language: b.language, status: "draft" } });
  const images = b.imageAssetIds?.length ? await db.mediaAsset.findMany({ where: { id: { in: b.imageAssetIds }, workspaceId: c.workspaceId } }) : [];
  if (b.generateScript) {
    const s = await videoScript({ workspaceId: c.workspaceId, userId: c.user.id }, { topic: b.topic, videoType: b.videoType, aspectRatio: b.aspectRatio, durationSec: b.durationSec, language: b.language, dialect: b.dialect,
      sourceText: b.sourceText ?? (images.length ? `فيديو من ${images.length} صور، مشهد لكل صورة بالترتيب.` : undefined) });
    await db.videoProject.update({ where: { id: v.id }, data: { title: b.title || s.title, script: s as object, status: "ready" } });
    const scenes = images.length ? images.map((img, i) => ({ ...(s.scenes[i] ?? { narration: "", onScreenText: "", visualPrompt: "", durationSec: 3 }), assetId: img.id })) : s.scenes.map((x) => ({ ...x, assetId: null as string | null }));
    await db.videoScene.createMany({ data: scenes.map((x, i) => ({ videoId: v.id, order: i, durationSec: Math.max(1.5, Math.min(60, x.durationSec || 4)), narration: x.narration, onScreenText: x.onScreenText, visualPrompt: x.visualPrompt, assetId: x.assetId })) });
  } else if (images.length) {
    await db.videoScene.createMany({ data: images.map((img, i) => ({ videoId: v.id, order: i, durationSec: 3, assetId: img.id })) });
    await db.videoProject.update({ where: { id: v.id }, data: { status: "ready" } });
  }
  return v;
});
