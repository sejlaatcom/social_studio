import { z } from "zod";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { assistantStream } from "@/lib/ai/service";
import { AppError } from "@/lib/errors";
import type { ChatMsg } from "@/lib/ai/types";

export const maxDuration = 300;
const S = z.object({ threadId: z.string().nullish(), message: z.string().trim().min(1).max(20000) });

// Streams assistant output as Server-Sent Events: {t:"delta",v} … {t:"done",threadId} | {t:"error",message}
export async function POST(req: Request) {
  let ctx;
  try { ctx = await requireCtx("ai.use"); await rateLimit(`chat:${ctx.user.id}`, 20, 60); }
  catch (e) { const err = e as AppError; return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status ?? 500 }); }
  const parsed = S.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "validation", message: "رسالة غير صالحة" } }, { status: 422 });
  const { threadId, message } = parsed.data;
  const thread = threadId ? await db.chatThread.findFirst({ where: { id: threadId, workspaceId: ctx.workspaceId, userId: ctx.user.id } }) : null;
  const history = ((thread?.messages as ChatMsg[] | undefined) ?? []).slice(-30);
  const messages: ChatMsg[] = [...history, { role: "user", content: message }];
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      try {
        const full = await assistantStream({ workspaceId: ctx.workspaceId, userId: ctx.user.id }, messages, (t) => send({ t: "delta", v: t }));
        const all = [...messages, { role: "assistant", content: full }];
        const saved = thread
          ? await db.chatThread.update({ where: { id: thread.id }, data: { messages: all } })
          : await db.chatThread.create({ data: { workspaceId: ctx.workspaceId, userId: ctx.user.id, title: message.slice(0, 80), messages: all } });
        send({ t: "done", threadId: saved.id });
      } catch (e) { send({ t: "error", message: (e as Error).message }); }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
