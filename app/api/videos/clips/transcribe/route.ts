import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { stt } from "@/lib/ai/registry";
import { extractAudio } from "@/lib/video";
import { trackAIUsage } from "@/lib/plans";
import { AppError, badRequest } from "@/lib/errors";
import { AIProviderError } from "@/lib/ai/types";

export const maxDuration = 300;
// Speech-to-text with timestamps (used for auto subtitles and long→short clip extraction).
export const POST = route(async (req) => {
  const c = await requireCtx("ai.use");
  const b = await body(req, z.object({ assetId: z.string(), language: z.string().max(5).optional() }));
  const a = await db.mediaAsset.findFirstOrThrow({ where: { id: b.assetId, workspaceId: c.workspaceId } });
  if (!a.mimeType.startsWith("video/") && !a.mimeType.startsWith("audio/")) throw badRequest("اختر ملف فيديو أو صوت");
  const audio = await extractAudio(a.id, c.workspaceId);
  if (audio.data.length > 24 * 1024 * 1024) throw badRequest("الملف الصوتي المستخرج أكبر من 24MB (حد مزود التفريغ)؛ قصّ الفيديو أولًا");
  const row = await db.aIRequest.create({ data: { workspaceId: c.workspaceId, userId: c.user.id, kind: "stt", provider: "openai", model: "whisper-1", prompt: `transcribe ${a.name}` } });
  try {
    const r = await (await stt(c.workspaceId)).transcribe({ file: audio.data, filename: "audio.mp3", language: b.language });
    await db.aIRequest.update({ where: { id: row.id }, data: { status: "succeeded", output: r as object } });
    await trackAIUsage(c.workspaceId, "stt");
    return { ...r, duration: audio.duration };
  } catch (e) {
    await db.aIRequest.update({ where: { id: row.id }, data: { status: "failed", error: (e as Error).message } });
    if (e instanceof AIProviderError) throw new AppError(502, "ai_error", e.message); throw e;
  }
});
