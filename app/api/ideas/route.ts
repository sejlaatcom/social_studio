import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const GET = route(async (req) => {
  const c = await requireCtx(); const sp = new URL(req.url).searchParams;
  const where: Prisma.ContentIdeaWhereInput = { workspaceId: c.workspaceId };
  if (sp.get("status")) where.status = sp.get("status")!;
  if (sp.get("q")) where.OR = [{ title: { contains: sp.get("q")!, mode: "insensitive" } }, { body: { contains: sp.get("q")!, mode: "insensitive" } }];
  return db.contentIdea.findMany({ where, orderBy: { createdAt: "desc" }, take: 300, include: { campaign: { select: { id: true, name: true } }, _count: { select: { posts: true } } } });
});
export const POST = route(async (req) => {
  const c = await requireCtx("content.create");
  const b = await body(req, z.object({ title: z.string().trim().min(1).max(200), body: z.string().max(10000).nullish(), tags: z.array(z.string().max(40)).max(20).default([]), campaignId: z.string().nullish() }));
  return db.contentIdea.create({ data: { ...b, workspaceId: c.workspaceId, createdById: c.user.id } });
});
