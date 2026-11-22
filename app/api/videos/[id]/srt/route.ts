import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { buildSrt } from "@/lib/video";

export const GET = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx(); const { id } = await params;
  const v = await db.videoProject.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId }, include: { scenes: { orderBy: { order: "asc" } } } });
  let t = 0; const items = v.scenes.map((s) => { const it = { start: t + 0.15, end: t + s.durationSec - 0.1, text: s.onScreenText || s.narration }; t += s.durationSec; return it; });
  return new Response(v.subtitlesSrt ?? buildSrt(items), { headers: { "content-type": "application/x-subrip; charset=utf-8", "content-disposition": `attachment; filename="subtitles.srt"` } });
});
