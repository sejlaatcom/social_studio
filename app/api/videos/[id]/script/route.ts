import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { videoScript } from "@/lib/ai/service";

export const maxDuration = 300;
export const POST = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("ai.use"); const { id } = await params;
  const b = await body(req, z.object({ durationSec: z.number().int().min(10).max(1200).default(45), sourceText: z.string().max(50000).optional(), dialect: z.string().optional() }));
  const v = await db.videoProject.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  await db.videoProject.update({ where: { id }, data: { status: "scripting" } });
  try {
    const s = await videoScript({ workspaceId: c.workspaceId, userId: c.user.id }, { topic: v.topic ?? v.title, videoType: v.videoType, aspectRatio: v.aspectRatio, durationSec: b.durationSec, language: v.language, dialect: b.dialect, sourceText: b.sourceText });
    await db.$transaction([
      db.videoScene.deleteMany({ where: { videoId: id } }),
      db.videoScene.createMany({ data: s.scenes.map((x, i) => ({ videoId: id, order: i, durationSec: Math.max(1.5, Math.min(60, x.durationSec || 4)), narration: x.narration, onScreenText: x.onScreenText, visualPrompt: x.visualPrompt })) }),
      db.videoProject.update({ where: { id }, data: { script: s as object, status: "ready" } }),
    ]);
    return s;
  } catch (e) { await db.videoProject.update({ where: { id }, data: { status: "draft" } }); throw e; }
});
