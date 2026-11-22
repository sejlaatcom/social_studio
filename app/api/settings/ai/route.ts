import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { setSetting, setSecret } from "@/lib/settings";
import { AI_KEYS } from "@/lib/ai/registry";

export const PUT = route(async (req) => {
  const c = await requireCtx("settings.manage");
  const b = await body(req, z.object({
    config: z.object({ llm: z.object({ provider: z.enum(["anthropic", "openai"]), model: z.string().min(2).max(80) }), image: z.object({ provider: z.enum(["openai", "stability"]), model: z.string().min(2).max(80) }), tts: z.object({ provider: z.enum(["openai", "elevenlabs"]), voice: z.string().max(80) }), stt: z.object({ provider: z.literal("openai") }) }).optional(),
    keys: z.record(z.enum(["anthropic", "openai", "stability", "elevenlabs"]), z.string().max(400).nullable()).optional(),
  }));
  if (b.config) await setSetting(c.workspaceId, "ai.config", b.config);
  for (const [k, v] of Object.entries(b.keys ?? {})) {
    if (v === "") continue; // empty = keep existing
    await setSecret(c.workspaceId, AI_KEYS[k as keyof typeof AI_KEYS].setting, v === null ? null : v.trim());
  }
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "settings.ai_update", meta: { keysChanged: Object.keys(b.keys ?? {}).filter((k) => b.keys![k as keyof typeof b.keys] !== "") } });
  return { ok: true };
});
