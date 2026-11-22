import { z } from "zod";
import sharp from "sharp";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { SIZE_PRESETS } from "@/lib/platforms";
import { designCopy } from "@/lib/ai/service";
import { imageGen } from "@/lib/ai/registry";
import { saveAsset } from "@/lib/media";
import { checkLimit, trackAIUsage } from "@/lib/plans";
import { buildLayout } from "@/lib/design";

export const maxDuration = 300;
// "Design a professional ad about 20% off" → AI copy + palette (+ optional AI background) → editable layered design.
export const POST = route(async (req) => {
  const c = await requireCtx("ai.use"); await rateLimit(`aidesign:${c.user.id}`, 10, 60);
  const b = await body(req, z.object({ prompt: z.string().min(3).max(3000), preset: z.string().default("instagram_post"), withImage: z.boolean().default(true), language: z.enum(["ar", "en"]).default("ar") }));
  const p = SIZE_PRESETS[b.preset as keyof typeof SIZE_PRESETS] ?? SIZE_PRESETS.instagram_post;
  const who = { workspaceId: c.workspaceId, userId: c.user.id };
  const copy = await designCopy(who, { prompt: b.prompt, width: p.width, height: p.height, language: b.language });
  let bgAssetId: string | null = null; let imageError: string | null = null;
  if (b.withImage) {
    try {
      await checkLimit(c.workspaceId, "aiImages");
      const gen = await imageGen(c.workspaceId);
      const img = await gen.generate({ prompt: `${copy.backgroundPrompt}. High quality, professional advertising photography, no text, no letters, no words.`, size: { width: p.width, height: p.height } });
      const data = await sharp(img.data).resize(p.width, p.height, { fit: "cover" }).png().toBuffer();
      bgAssetId = (await saveAsset({ ...who, name: `bg-${b.prompt.slice(0, 30)}.png`, data, mimeType: "image/png", source: "ai_image", tags: ["ai", "background"] })).id;
      await trackAIUsage(c.workspaceId, "image");
    } catch (e) { imageError = (e as Error).message; }
  }
  const kit = await db.brandKit.findFirst({ where: { workspaceId: c.workspaceId }, orderBy: [{ isDefault: "desc" }] });
  const fonts = (kit?.fonts as { role: string; family: string }[] | undefined) ?? [];
  const doc = buildLayout({ W: p.width, H: p.height, copy, palette: copy.palette, layout: copy.layout, bgAssetId, logoAssetId: kit?.logoAssetId, headingFont: fonts.find((f) => f.role === "heading")?.family, bodyFont: fonts.find((f) => f.role === "body")?.family });
  const design = await db.designProject.create({ data: { workspaceId: c.workspaceId, name: copy.headline.slice(0, 80), preset: b.preset, width: p.width, height: p.height, document: doc } });
  return { design, imageError };
});
