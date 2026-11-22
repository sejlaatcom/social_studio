import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { conflict } from "@/lib/errors";

export const GET = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx(); const { id } = await params;
  return db.mediaAsset.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: { postMedia: { include: { post: { select: { id: true, title: true, status: true, publishedAt: true, scheduledAt: true } } } }, campaign: true, project: true } });
});

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("media.manage"); const { id } = await params;
  const b = await body(req, z.object({ name: z.string().min(1).max(200).optional(), tags: z.array(z.string().max(40)).max(30).optional(), platforms: z.array(z.string()).optional(), kind: z.string().optional(), campaignId: z.string().nullable().optional(), projectId: z.string().nullable().optional() }));
  await db.mediaAsset.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  return db.mediaAsset.update({ where: { id }, data: b });
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("media.manage"); const { id } = await params;
  const a = await db.mediaAsset.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: { _count: { select: { postMedia: true } } } });
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (a._count.postMedia > 0 && !force) throw conflict(`الملف مستخدم في ${a._count.postMedia} منشور. أكد الحذف لإزالته منها.`);
  await db.mediaAsset.delete({ where: { id } });
  await storage().delete(a.storageKey);
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "media.delete", entityType: "MediaAsset", entityId: id, meta: { name: a.name } });
  return { ok: true };
});
