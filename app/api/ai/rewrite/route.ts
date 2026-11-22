import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { rewrite } from "@/lib/ai/service";

export const maxDuration = 120;
export const POST = route(async (req) => {
  const c = await requireCtx("ai.use"); await rateLimit(`ai:${c.user.id}`, 30, 60);
  const b = await body(req, z.object({ text: z.string().min(1).max(20000), instruction: z.string().min(2).max(1000), platform: z.string().max(20).optional(), language: z.string().optional(), count: z.number().int().min(1).max(5).default(3) }));
  return rewrite({ workspaceId: c.workspaceId, userId: c.user.id }, b);
});
