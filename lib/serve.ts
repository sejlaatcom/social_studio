import fs from "node:fs";
import { Readable } from "node:stream";
import { storage } from "./storage";

export async function serveAsset(req: Request, a: { storageKey: string; mimeType: string; name: string; sizeBytes: bigint }, download = false) {
  const path = await storage().localPath(a.storageKey);
  const size = Number(a.sizeBytes);
  const headers: Record<string, string> = {
    "content-type": a.mimeType, "accept-ranges": "bytes", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff",
    "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(a.name)}`,
    "content-security-policy": "default-src 'none'; sandbox",
  };
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0; const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    const stream = Readable.toWeb(fs.createReadStream(path, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) } });
  }
  return new Response(Readable.toWeb(fs.createReadStream(path)) as ReadableStream, { headers: { ...headers, "content-length": String(size) } });
}
