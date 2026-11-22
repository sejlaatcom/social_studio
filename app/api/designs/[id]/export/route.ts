import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveAsset } from "@/lib/media";
import { SIZE_PRESETS } from "@/lib/platforms";
import { badRequest } from "@/lib/errors";
import sharp from "sharp";

// Receives the client-rendered PNG and stores it as a media asset (JPEG for photo-heavy designs on request).
export const POST = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("content.create"); const { id } = await params;
  const d = await db.designProject.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  const fd = await req.formData(); const f = fd.get("file");
  if (!(f instanceof File)) throw badRequest("ملف التصدير مفقود");
  let data = Buffer.from(await f.arrayBuffer());
  const meta = await sharp(data).metadata();
  if (meta.width !== d.width || meta.height !== d.height) throw badRequest("أبعاد الملف المصدَّر لا تطابق التصميم");
  const jpeg = fd.get("format") === "jpeg";
  if (jpeg) data = await sharp(data).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
  const preset = SIZE_PRESETS[d.preset as keyof typeof SIZE_PRESETS];
  const asset = await saveAsset({ workspaceId: c.workspaceId, userId: c.user.id, name: `${d.name}.${jpeg ? "jpg" : "png"}`, data, mimeType: jpeg ? "image/jpeg" : "image/png", kind: "design", source: "design_export", tags: ["design", d.preset], platforms: preset ? [...preset.platforms] : [] });
  await db.designProject.update({ where: { id }, data: { thumbnailAssetId: asset.id } });
  return asset;
});
