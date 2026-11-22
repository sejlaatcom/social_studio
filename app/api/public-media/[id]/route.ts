import { db } from "@/lib/db";
import { verifyMediaSignature } from "@/lib/storage";
import { serveAsset } from "@/lib/serve";

// Signed, expiring URL used by platforms that fetch media by URL (Instagram, etc.).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const sp = new URL(req.url).searchParams;
  if (!verifyMediaSignature(id, sp.get("exp") ?? "0", sp.get("sig") ?? "")) return new Response("Forbidden", { status: 403 });
  const a = await db.mediaAsset.findUnique({ where: { id } });
  if (!a) return new Response("Not found", { status: 404 });
  return serveAsset(req, a);
}
