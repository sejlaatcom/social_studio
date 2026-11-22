import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { imageGen } from "@/lib/ai/registry";
import { saveAsset } from "@/lib/media";
import { checkLimit, trackAIUsage } from "@/lib/plans";
import { AppError } from "@/lib/errors";
import { AIProviderError } from "@/lib/ai/types";
import sharp from "sharp";

export const maxDuration = 300;
export const POST = route(async (req) => {
  const c = await requireCtx("ai.use"); await rateLimit(`aiimg:${c.user.id}`, 10, 60);
  const b = await body(req, z.object({ prompt: z.string().min(3).max(4000), width: z.number().int().min(256).max(4096).default(1080), height: z.number().int().min(256).max(4096).default(1080), name: z.string().max(100).optional(), fit: z.boolean().default(true), tags: z.array(z.string()).default([]) }));
  await checkLimit(c.workspaceId, "aiImages");
  const p = await imageGen(c.workspaceId);
  const reqRow = await db.aIRequest.create({ data: { workspaceId: c.workspaceId, userId: c.user.id, kind: "image", provider: p.id, model: p.model, prompt: b.prompt } });
  const t0 = Date.now();
  try {
    const img = await p.generate({ prompt: b.prompt, size: { width: b.width, height: b.height } });
    // Fit to the exact requested canvas (cover crop) so the asset matches platform presets.
    const data = b.fit ? await sharp(img.data).resize(b.width, b.height, { fit: "cover" }).png().toBuffer() : img.data;
    const asset = await saveAsset({ workspaceId: c.workspaceId, userId: c.user.id, name: (b.name ?? b.prompt.slice(0, 40)) + ".png", data, mimeType: "image/png", source: "ai_image", tags: ["ai", ...b.tags] });
    await db.aIRequest.update({ where: { id: reqRow.id }, data: { status: "succeeded", output: { assetId: asset.id }, latencyMs: Date.now() - t0 } });
    await trackAIUsage(c.workspaceId, "image");
    return asset;
  } catch (e) {
    await db.aIRequest.update({ where: { id: reqRow.id }, data: { status: "failed", error: (e as Error).message, latencyMs: Date.now() - t0 } });
    if (e instanceof AIProviderError) throw new AppError(502, "ai_error", e.message);
    throw e;
  }
});
