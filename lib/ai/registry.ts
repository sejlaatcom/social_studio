import { getSecret, getSetting } from "../settings";
import { notConfigured } from "../errors";
import { AnthropicProvider } from "./anthropic";
import { OpenAIImage, OpenAILLM, OpenAISTT, OpenAITTS } from "./openai";
import { ElevenLabsTTS, StabilityImage } from "./others";
import type { ImageProvider, LLMProvider, STTProvider, TTSProvider } from "./types";

export type AIConfig = {
  llm: { provider: "anthropic" | "openai"; model: string };
  image: { provider: "openai" | "stability"; model: string };
  tts: { provider: "openai" | "elevenlabs"; voice: string };
  stt: { provider: "openai" };
};
export const DEFAULT_AI_CONFIG: AIConfig = {
  llm: { provider: "anthropic", model: "claude-opus-5-5" },
  image: { provider: "openai", model: "gpt-image-1" },
  tts: { provider: "openai", voice: "alloy" },
  stt: { provider: "openai" },
};
export const AI_KEYS = {
  anthropic: { setting: "ai.key.anthropic", env: "ANTHROPIC_API_KEY", label: "Anthropic (Claude)" },
  openai: { setting: "ai.key.openai", env: "OPENAI_API_KEY", label: "OpenAI" },
  stability: { setting: "ai.key.stability", env: "STABILITY_API_KEY", label: "Stability AI" },
  elevenlabs: { setting: "ai.key.elevenlabs", env: "ELEVENLABS_API_KEY", label: "ElevenLabs" },
} as const;
type KeyName = keyof typeof AI_KEYS;

export async function getAIConfig(ws: string): Promise<AIConfig> {
  const s = await getSetting<Partial<AIConfig>>(ws, "ai.config");
  return { ...DEFAULT_AI_CONFIG, ...(s ?? {}) };
}
async function key(ws: string, name: KeyName) {
  const k = await getSecret(ws, AI_KEYS[name].setting, AI_KEYS[name].env);
  if (!k) throw notConfigured(`لم يتم إعداد مفتاح ${AI_KEYS[name].label}. أضفه من الإعدادات ← الذكاء الاصطناعي.`);
  return k;
}

export async function llm(ws: string): Promise<LLMProvider> {
  const c = (await getAIConfig(ws)).llm;
  return c.provider === "openai" ? new OpenAILLM(await key(ws, "openai"), c.model) : new AnthropicProvider(await key(ws, "anthropic"), c.model);
}
export async function imageGen(ws: string): Promise<ImageProvider> {
  const c = (await getAIConfig(ws)).image;
  return c.provider === "stability" ? new StabilityImage(await key(ws, "stability"), c.model) : new OpenAIImage(await key(ws, "openai"), c.model);
}
export async function tts(ws: string): Promise<TTSProvider & { voice: string }> {
  const c = (await getAIConfig(ws)).tts;
  const p = c.provider === "elevenlabs" ? new ElevenLabsTTS(await key(ws, "elevenlabs")) : new OpenAITTS(await key(ws, "openai"));
  return Object.assign(p, { voice: c.voice });
}
export async function stt(ws: string): Promise<STTProvider> {
  return new OpenAISTT(await key(ws, "openai"));
}
