import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { generateIdeas } from "@/lib/ai/service";

export const maxDuration = 120;
export const POST = route(async (req) => {
  const c = await requireCtx("ai.use"); await rateLimit(`ai:${c.user.id}`, 30, 60);
  const b = await body(req, z.object({ topic: z.string().min(2).max(2000), count: z.number().int().min(1).max(30).default(10), language: z.enum(["ar", "en"]).default("ar"), dialect: z.string().optional(), save: z.boolean().default(true), campaignId: z.string().nullish() }));
  const r = await generateIdeas({ workspaceId: c.workspaceId, userId: c.user.id }, b);
  if (b.save) await db.contentIdea.createMany({ data: r.ideas.map((i) => ({ workspaceId: c.workspaceId, title: i.title.slice(0, 200), body: i.body, tags: [...i.platforms, i.contentType], createdById: c.user.id, campaignId: b.campaignId ?? null })) });
  return r;
});
