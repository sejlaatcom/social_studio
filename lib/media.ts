import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "./db";
import { newStorageKey, storage } from "./storage";
import { checkLimit } from "./plans";

const pexec = promisify(execFile);

export const ALLOWED_MIME: Record<string, string> = {
  "image/png": "image", "image/jpeg": "image", "image/webp": "image", "image/gif": "image", "image/svg+xml": "image",
  "video/mp4": "video", "video/quicktime": "video", "video/webm": "video",
  "audio/mpeg": "audio", "audio/wav": "audio", "audio/x-wav": "audio", "audio/ogg": "audio", "audio/mp4": "audio", "audio/aac": "audio",
  "application/pdf": "pdf", "application/json": "design",
};
export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024; // 1GB

/** Sniffs a few magic numbers so a renamed file cannot masquerade as an image/video. */
export function sniffMime(buf: Buffer, declared: string): string | null {
  const h = buf.subarray(0, 16);
  const hex = h.toString("hex");
  if (hex.startsWith("89504e47")) return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (h.subarray(0, 4).toString() === "RIFF" && h.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (h.subarray(0, 4).toString() === "RIFF" && h.subarray(8, 12).toString() === "WAVE") return "audio/wav";
  if (h.subarray(0, 3).toString() === "GIF") return "image/gif";
  if (h.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (h.subarray(4, 8).toString() === "ftyp") {
    const brand = h.subarray(8, 12).toString();
    if (brand.startsWith("qt")) return "video/quicktime";
    if (brand.startsWith("M4A")) return "audio/mp4";
    return "video/mp4";
  }
  if (hex.startsWith("1a45dfa3")) return "video/webm";
  if (hex.startsWith("494433") || hex.startsWith("fffb") || hex.startsWith("fff3")) return "audio/mpeg";
  if (h.subarray(0, 4).toString() === "OggS") return "audio/ogg";
  if (declared === "image/svg+xml" && buf.subarray(0, 2048).toString().includes("<svg")) return "image/svg+xml";
  if (declared === "application/json") { try { JSON.parse(buf.toString()); return "application/json"; } catch { return null; } }
  return null;
}

async function probe(path: string) {
  try {
    const { stdout } = await pexec("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path]);
    const j = JSON.parse(stdout);
    const v = j.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
    return { width: v?.width as number | undefined, height: v?.height as number | undefined, duration: j.format?.duration ? Number(j.format.duration) : undefined };
  } catch { return {}; }
}

export async function saveAsset(opts: {
  workspaceId: string; userId?: string | null; name: string; data: Buffer; mimeType: string;
  kind?: string; source?: string; tags?: string[]; platforms?: string[]; projectId?: string | null; campaignId?: string | null;
}) {
  const sniffed = sniffMime(opts.data, opts.mimeType);
  if (!sniffed || !ALLOWED_MIME[sniffed]) throw new Error("نوع الملف غير مدعوم");
  if (opts.data.length > MAX_UPLOAD_BYTES) throw new Error("حجم الملف أكبر من المسموح");
  await checkLimit(opts.workspaceId, "storageMb", opts.data.length / 1024 / 1024);
  let data = opts.data;
  if (sniffed === "image/svg+xml") {
    // Rasterize SVG to PNG to neutralize embedded scripts.
    data = await sharp(data).png().toBuffer();
  }
  const mime = sniffed === "image/svg+xml" ? "image/png" : sniffed;
  const key = newStorageKey(opts.workspaceId, opts.name.replace(/\.svg$/i, ".png"));
  await storage().put(key, data, mime);
  let width: number | undefined, height: number | undefined, durationSec: number | undefined;
  if (mime.startsWith("image/")) {
    const m = await sharp(data).metadata(); width = m.width; height = m.height;
  } else if (mime.startsWith("video/") || mime.startsWith("audio/")) {
    const p = await probe(await storage().localPath(key)); width = p.width; height = p.height; durationSec = p.duration;
  }
  return db.mediaAsset.create({
    data: {
      workspaceId: opts.workspaceId, uploadedById: opts.userId ?? null, name: opts.name.slice(0, 200), mimeType: mime,
      sizeBytes: BigInt(data.length), storageKey: key, width, height, durationSec,
      kind: opts.kind ?? ALLOWED_MIME[mime], source: opts.source ?? "upload", tags: opts.tags ?? [], platforms: opts.platforms ?? [],
      projectId: opts.projectId ?? null, campaignId: opts.campaignId ?? null,
    },
  });
}
