import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { getAIConfig, AI_KEYS } from "@/lib/ai/registry";
import { hasSecret } from "@/lib/settings";

export const GET = route(async () => {
  const c = await requireCtx();
  const cfg = await getAIConfig(c.workspaceId);
  const keys: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(AI_KEYS)) keys[k] = await hasSecret(c.workspaceId, v.setting, v.env);
  const need = { llm: cfg.llm.provider, image: cfg.image.provider, tts: cfg.tts.provider, stt: "openai" } as Record<string, string>;
  return { config: cfg, keys, ready: Object.fromEntries(Object.entries(need).map(([k, p]) => [k, keys[p] ?? false])) };
});
