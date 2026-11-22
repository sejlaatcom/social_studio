import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { checkLimit } from "@/lib/plans";
import { PostSchema } from "./schema";
import { savePost } from "./save";
import type { Prisma } from "@prisma/client";

export const GET = route(async (req) => {
  const c = await requireCtx(); const sp = new URL(req.url).searchParams;
  const where: Prisma.PostWhereInput = { workspaceId: c.workspaceId };
  if (sp.get("status")) where.status = { in: sp.get("status")!.split(",") };
  if (sp.get("platform")) where.variants = { some: { platform: sp.get("platform")! } };
  if (sp.get("campaignId")) where.campaignPosts = { some: { campaignId: sp.get("campaignId")! } };
  if (sp.get("q")) where.OR = [{ title: { contains: sp.get("q")!, mode: "insensitive" } }, { body: { contains: sp.get("q")!, mode: "insensitive" } }];
  if (sp.get("from") && sp.get("to")) where.OR = [
    { scheduledAt: { gte: new Date(sp.get("from")!), lte: new Date(sp.get("to")!) } },
    { scheduledAt: null, publishedAt: { gte: new Date(sp.get("from")!), lte: new Date(sp.get("to")!) } },
  ];
  const take = Math.min(Number(sp.get("take") ?? 100), 500);
  return db.post.findMany({
    where, take, orderBy: sp.get("from") ? { scheduledAt: "asc" } : { updatedAt: "desc" },
    include: { variants: { select: { id: true, platform: true, status: true, format: true, externalUrl: true, socialAccount: { select: { displayName: true } } } }, media: { take: 1, orderBy: { order: "asc" }, include: { asset: { select: { id: true, mimeType: true, name: true, kind: true, sizeBytes: true, tags: true, platforms: true, createdAt: true, source: true } } } }, author: { select: { name: true } }, campaignPosts: { include: { campaign: { select: { id: true, name: true } } } } },
  });
});

export const POST = route(async (req) => {
  const c = await requireCtx("content.create");
  const b = await body(req, PostSchema);
  await checkLimit(c.workspaceId, "postsPerMonth");
  const post = await savePost(c.workspaceId, c.user.id, b);
  if (b.ideaId) await db.contentIdea.updateMany({ where: { id: b.ideaId, workspaceId: c.workspaceId }, data: { status: "used" } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "post.create", entityType: "Post", entityId: post.id });
  return post;
});
