import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { cutClip } from "@/lib/video";
import { badRequest } from "@/lib/errors";

export const maxDuration = 300;
export const POST = route(async (req) => {
  const c = await requireCtx("content.create");
  const b = await body(req, z.object({ assetId: z.string(), start: z.number().min(0), end: z.number(), title: z.string().max(120), burnSubtitles: z.boolean().default(true), segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })).optional() }));
  if (b.end - b.start < 1 || b.end - b.start > 600) throw badRequest("مدة المقطع غير صالحة");
  return cutClip({ workspaceId: c.workspaceId, assetId: b.assetId, start: b.start, end: b.end, title: b.title, segments: b.burnSubtitles ? b.segments : undefined });
});
