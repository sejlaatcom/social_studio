import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { conflict } from "@/lib/errors";
import { PostSchema } from "../schema";
import { savePost } from "../save";

export const GET = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx(); const { id } = await params;
  return db.post.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: {
    variants: { include: { socialAccount: { select: { id: true, displayName: true, username: true, avatarUrl: true, status: true, platform: true } }, media: { include: { asset: true }, orderBy: { order: "asc" } },
      jobs: { orderBy: { createdAt: "desc" }, take: 5, include: { logs: { orderBy: { createdAt: "asc" } } } }, analytics: { orderBy: { capturedAt: "desc" }, take: 1 } } },
    media: { where: { variantId: null }, include: { asset: true }, orderBy: { order: "asc" } },
    approvals: { orderBy: { createdAt: "desc" }, include: { reviewer: { select: { name: true } } } },
    campaignPosts: { include: { campaign: { select: { id: true, name: true } } } }, author: { select: { name: true } },
  } });
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("content.edit"); const { id } = await params;
  const p = await db.post.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  if (["publishing"].includes(p.status)) throw conflict("لا يمكن تعديل منشور جاري نشره");
  const b = await body(req, PostSchema);
  if (b.status === "approved" && p.status !== "approved" && !c.can("content.approve")) b.status = "in_review";
  const post = await savePost(c.workspaceId, c.user.id, b, id);
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "post.update", entityType: "Post", entityId: id });
  return post;
});

export const DELETE = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("content.delete"); const { id } = await params;
  const p = await db.post.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  if (p.status === "publishing") throw conflict("لا يمكن حذف منشور جاري نشره");
  await db.post.delete({ where: { id } });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "post.delete", entityType: "Post", entityId: id, meta: { title: p.title } });
  return { ok: true };
});
