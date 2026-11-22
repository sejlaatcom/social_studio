import sharp from "sharp";
import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { imageGen } from "@/lib/ai/registry";
import { saveAsset } from "@/lib/media";
import { checkLimit, trackAIUsage } from "@/lib/plans";
import { ASPECTS } from "@/lib/video";
import { AppError, badRequest } from "@/lib/errors";
import { AIProviderError } from "@/lib/ai/types";

export const maxDuration = 300;
export const POST = route<{ id: string; sceneId: string }>(async (_r, { params }) => {
  const c = await requireCtx("ai.use"); const { id, sceneId } = await params;
  const v = await db.videoProject.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  const s = await db.videoScene.findFirstOrThrow({ where: { id: sceneId, videoId: id } });
  if (!s.visualPrompt.trim()) throw badRequest("أضف وصفًا بصريًا للمشهد أولًا");
  await checkLimit(c.workspaceId, "aiImages");
  const [W, H] = ASPECTS[v.aspectRatio] ?? ASPECTS["9:16"];
  try {
    const img = await (await imageGen(c.workspaceId)).generate({ prompt: `${s.visualPrompt}. Cinematic, high quality, no text, no captions, no letters.`, size: { width: W, height: H } });
    const data = await sharp(img.data).resize(W, H, { fit: "cover" }).png().toBuffer();
    const a = await saveAsset({ workspaceId: c.workspaceId, userId: c.user.id, name: `scene-${s.order + 1}-${v.title.slice(0, 30)}.png`, data, mimeType: "image/png", source: "ai_image", tags: ["video-scene", "ai"] });
    await db.videoScene.update({ where: { id: sceneId }, data: { assetId: a.id } });
    await trackAIUsage(c.workspaceId, "image");
    return a;
  } catch (e) { if (e instanceof AIProviderError) throw new AppError(502, "ai_error", e.message); throw e; }
});
