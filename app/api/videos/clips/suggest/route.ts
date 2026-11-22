import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { suggestClips } from "@/lib/ai/service";

export const maxDuration = 300;
export const POST = route(async (req) => {
  const c = await requireCtx("ai.use");
  const b = await body(req, z.object({ segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })).min(1).max(5000), count: z.number().int().min(1).max(10).default(3), maxSec: z.number().int().min(15).max(180).default(60) }));
  return suggestClips({ workspaceId: c.workspaceId, userId: c.user.id }, b);
});
