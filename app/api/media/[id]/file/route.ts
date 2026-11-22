import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { route } from "@/lib/api";
import { serveAsset } from "@/lib/serve";

// Authenticated file delivery with HTTP Range support (video seeking).
export const GET = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx(); const { id } = await params;
  const a = await db.mediaAsset.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  return serveAsset(req, a, new URL(req.url).searchParams.get("download") === "1");
});

