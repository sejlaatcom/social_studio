import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { llm } from "@/lib/ai/registry";
import { AppError } from "@/lib/errors";

export const maxDuration = 120;
export const POST = route(async () => {
  const c = await requireCtx("settings.manage");
  const p = await llm(c.workspaceId);
  try { const r = await p.generateText({ system: "Reply with exactly: OK", messages: [{ role: "user", content: "ping" }], effort: "low", maxTokens: 2000 }); return { ok: true, provider: p.id, model: r.model, reply: r.data.slice(0, 50) }; }
  catch (e) { throw new AppError(502, "ai_error", (e as Error).message); }
});
