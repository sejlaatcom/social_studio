import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { generateContentPack } from "@/lib/ai/service";

export const maxDuration = 300;
export const POST = route(async (req) => {
  const c = await requireCtx("ai.use");
  await rateLimit(`ai:${c.user.id}`, 30, 60);
  const b = await body(req, z.object({ idea: z.string().trim().min(3).max(5000), tone: z.string().max(30).default("marketing"), language: z.enum(["ar", "en"]).default("ar"), dialect: z.string().max(30).optional(), brandKitId: z.string().nullish(), saveIdea: z.boolean().default(true) }));
  const pack = await generateContentPack({ workspaceId: c.workspaceId, userId: c.user.id }, b);
  let ideaId: string | null = null;
  if (b.saveIdea) {
    const idea = await db.contentIdea.create({ data: { workspaceId: c.workspaceId, title: pack.headline.slice(0, 200), body: b.idea, generated: pack as object, status: "in_progress", createdById: c.user.id } });
    ideaId = idea.id;
  }
  return { pack, ideaId };
});
