import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { conflict } from "@/lib/errors";

export const GET = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx(); const { id } = await params;
  const v = await db.videoProject.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: { scenes: { orderBy: { order: "asc" } } } });
  const ids = [...v.scenes.flatMap((s) => [s.assetId, s.voiceAssetId]), v.musicAssetId, v.outputAssetId].filter(Boolean) as string[];
  const assets = await db.mediaAsset.findMany({ where: { id: { in: ids } } });
  return { ...v, assets: Object.fromEntries(assets.map((a) => [a.id, a])) };
});
const Scene = z.object({ id: z.string().optional(), durationSec: z.number().min(0.5).max(120), narration: z.string().max(3000), onScreenText: z.string().max(300), visualPrompt: z.string().max(2000), assetId: z.string().nullish(), transition: z.string().max(20).default("fade"), voiceAssetId: z.string().nullish() });
export const PUT = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("content.edit"); const { id } = await params;
  const b = await body(req, z.object({ title: z.string().min(1).max(200), aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]), musicAssetId: z.string().nullish(), scenes: z.array(Scene).max(100) }));
  const v = await db.videoProject.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: { scenes: true } });
  if (v.status === "rendering") throw conflict("الفيديو قيد الإخراج حاليًا");
  const ids = b.scenes.flatMap((s) => [s.assetId, s.voiceAssetId]).concat(b.musicAssetId).filter(Boolean) as string[];
  const valid = new Set((await db.mediaAsset.findMany({ where: { id: { in: ids }, workspaceId: c.workspaceId }, select: { id: true } })).map((a) => a.id));
  await db.$transaction(async (tx) => {
    await tx.videoProject.update({ where: { id }, data: { title: b.title, aspectRatio: b.aspectRatio, musicAssetId: b.musicAssetId && valid.has(b.musicAssetId) ? b.musicAssetId : null, status: v.status === "rendered" || v.status === "failed" ? "ready" : v.status === "draft" ? "ready" : v.status } });
    await tx.videoScene.deleteMany({ where: { videoId: id } });
    await tx.videoScene.createMany({ data: b.scenes.map((s, i) => {
      const prev = v.scenes.find((p) => p.id === s.id);
      const voice = prev && prev.narration === s.narration ? (s.voiceAssetId ?? null) : null; // invalidate voice when narration changed
      return { videoId: id, order: i, durationSec: s.durationSec, narration: s.narration, onScreenText: s.onScreenText, visualPrompt: s.visualPrompt, transition: s.transition, assetId: s.assetId && valid.has(s.assetId) ? s.assetId : null, voiceAssetId: voice && valid.has(voice) ? voice : null };
    }) });
  });
  return { ok: true };
});
export const DELETE = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("content.delete"); const { id } = await params;
  await db.videoProject.deleteMany({ where: { id, workspaceId: c.workspaceId } }); return { ok: true };
});
