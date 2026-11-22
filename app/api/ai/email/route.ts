import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { emailContent } from "@/lib/ai/service";

export const maxDuration = 120;
export const POST = route(async (req) => {
  const c = await requireCtx("ai.use");
  const b = await body(req, z.object({ goal: z.string().min(3).max(3000), kind: z.string().max(50).default("newsletter"), language: z.enum(["ar", "en"]).default("ar"), dialect: z.string().optional() }));
  return emailContent({ workspaceId: c.workspaceId, userId: c.user.id }, b);
});
