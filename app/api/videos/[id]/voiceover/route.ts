import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateVoiceover } from "@/lib/video";
import { AppError } from "@/lib/errors";
import { AIProviderError } from "@/lib/ai/types";

export const maxDuration = 300;
export const POST = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("ai.use"); const { id } = await params;
  await db.videoProject.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  try { await generateVoiceover(id, c.user.id); } catch (e) { if (e instanceof AIProviderError) throw new AppError(502, "ai_error", e.message); throw e; }
  return { ok: true };
});
