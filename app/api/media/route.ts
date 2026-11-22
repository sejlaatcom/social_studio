import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveAsset } from "@/lib/media";
import { audit } from "@/lib/audit";
import { getLimits, usage } from "@/lib/plans";
import { badRequest } from "@/lib/errors";
import type { Prisma } from "@prisma/client";

export const GET = route(async (req) => {
  const c = await requireCtx(); const sp = new URL(req.url).searchParams;
  const where: Prisma.MediaAssetWhereInput = { workspaceId: c.workspaceId };
  if (sp.get("kind")) where.kind = sp.get("kind")!;
  if (sp.get("platform")) where.platforms = { has: sp.get("platform")! };
  if (sp.get("tag")) where.tags = { has: sp.get("tag")! };
  if (sp.get("campaignId")) where.campaignId = sp.get("campaignId")!;
  if (sp.get("projectId")) where.projectId = sp.get("projectId")!;
  if (sp.get("source")) where.source = sp.get("source")!;
  const q = sp.get("q")?.trim();
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { tags: { has: q } }];
  const take = Math.min(Number(sp.get("take") ?? 60), 200); const skip = Number(sp.get("skip") ?? 0);
  const [items, total, size, limits, tags] = await Promise.all([
    db.mediaAsset.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, include: { _count: { select: { postMedia: true } }, campaign: { select: { name: true } }, project: { select: { name: true } } } }),
    db.mediaAsset.count({ where }),
    db.mediaAsset.aggregate({ where: { workspaceId: c.workspaceId }, _sum: { sizeBytes: true } }),
    getLimits(c.workspaceId),
    db.$queryRaw<{ tag: string }[]>`SELECT DISTINCT unnest(tags) AS tag FROM "MediaAsset" WHERE "workspaceId" = ${c.workspaceId} LIMIT 100`,
  ]);
  return { items, total, storage: { usedBytes: Number(size._sum.sizeBytes ?? 0n), limitMb: limits?.storageMb ?? null }, tags: tags.map((t) => t.tag) };
});

export const POST = route(async (req) => {
  const c = await requireCtx("media.manage");
  const fd = await req.formData();
  const files = fd.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) throw badRequest("لم يتم اختيار ملفات");
  const tags = String(fd.get("tags") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const platforms = String(fd.get("platforms") ?? "").split(",").filter(Boolean);
  const out = []; const errors: string[] = [];
  for (const f of files) {
    try {
      const a = await saveAsset({ workspaceId: c.workspaceId, userId: c.user.id, name: f.name, data: Buffer.from(await f.arrayBuffer()), mimeType: f.type, tags, platforms,
        kind: fd.get("kind") ? String(fd.get("kind")) : undefined, campaignId: (fd.get("campaignId") as string) || null, projectId: (fd.get("projectId") as string) || null });
      out.push(a);
    } catch (e) { errors.push(`${f.name}: ${(e as Error).message}`); }
  }
  if (out.length) await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "media.upload", meta: { count: out.length } });
  void usage;
  return { items: out, errors };
});
