import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { SIZE_PRESETS } from "@/lib/platforms";
import { buildLayout, TEMPLATES } from "@/lib/design";

export const GET = route(async () => {
  const c = await requireCtx();
  return db.designProject.findMany({ where: { workspaceId: c.workspaceId }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, preset: true, width: true, height: true, thumbnailAssetId: true, isTemplate: true, updatedAt: true } });
});
export const POST = route(async (req) => {
  const c = await requireCtx("content.create");
  const b = await body(req, z.object({ name: z.string().min(1).max(200), preset: z.string(), width: z.number().int().min(100).max(4096).optional(), height: z.number().int().min(100).max(4096).optional(), templateId: z.string().optional(), document: z.any().optional() }));
  const p = SIZE_PRESETS[b.preset as keyof typeof SIZE_PRESETS];
  const W = b.width ?? p?.width ?? 1080, H = b.height ?? p?.height ?? 1080;
  const kit = await db.brandKit.findFirst({ where: { workspaceId: c.workspaceId }, orderBy: [{ isDefault: "desc" }] });
  const tpl = TEMPLATES.find((x) => x.id === b.templateId);
  const fonts = (kit?.fonts as { role: string; family: string }[] | undefined) ?? [];
  const doc = b.document ?? (tpl ? buildLayout({ W, H, copy: tpl.copy, palette: tpl.palette, layout: tpl.layout, logoAssetId: kit?.logoAssetId, headingFont: fonts.find((f) => f.role === "heading")?.family, bodyFont: fonts.find((f) => f.role === "body")?.family }) : { background: { type: "color", color: "#ffffff" }, layers: [] });
  return db.designProject.create({ data: { workspaceId: c.workspaceId, name: b.name, preset: b.preset, width: W, height: H, document: doc } });
});
