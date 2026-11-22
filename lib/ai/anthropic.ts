import Anthropic from "@anthropic-ai/sdk";
import { AIProviderError, type ChatMsg, type LLMProvider, type LLMResult } from "./types";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function textOf(msg: Anthropic.Beta.BetaMessage) {
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}
function check(msg: Anthropic.Beta.BetaMessage) {
  if (msg.stop_reason === "refusal") throw new AIProviderError("anthropic", "رفض النموذج تنفيذ الطلب لأسباب تتعلق بسياسات الاستخدام. عدّل الطلب وحاول مجددًا.");
  if (msg.stop_reason === "max_tokens") throw new AIProviderError("anthropic", "تجاوز الرد الحد الأقصى للطول. جرّب طلبًا أقصر.");
}
function wrap(e: unknown): never {
  if (e instanceof AIProviderError) throw e;
  if (e instanceof Anthropic.AuthenticationError) throw new AIProviderError("anthropic", "مفتاح Anthropic API غير صالح. حدّثه من الإعدادات.", 401);
  if (e instanceof Anthropic.RateLimitError) throw new AIProviderError("anthropic", "تم تجاوز حد الطلبات لدى Anthropic، حاول لاحقًا.", 429);
  if (e instanceof Anthropic.BadRequestError) throw new AIProviderError("anthropic", `طلب غير صالح: ${e.message}`, 400);
  if (e instanceof Anthropic.APIError) throw new AIProviderError("anthropic", `خطأ من Anthropic (${e.status}): ${e.message}`, e.status);
  throw new AIProviderError("anthropic", (e as Error).message);
}

export class AnthropicProvider implements LLMProvider {
  id = "anthropic";
  private client: Anthropic;
  // baseURL is explicit so an ambient ANTHROPIC_BASE_URL never silently redirects traffic; override with AI_ANTHROPIC_BASE_URL (proxy/gateway).
  constructor(apiKey: string, public model = "claude-opus-5-5") { this.client = new Anthropic({ apiKey, baseURL: process.env.AI_ANTHROPIC_BASE_URL || "https://api.anthropic.com", maxRetries: 2 }); }

  private base(effort: "low" | "medium" | "high" = "medium") {
    return {
      model: this.model,
      thinking: { type: "adaptive" as const },
      betas: [FALLBACK_BETA],
      fallbacks: "default" as const,
      output_config: { effort },
    };
  }

  async generateJSON<T>(o: { system: string; prompt: string; schema: Record<string, unknown>; effort?: "low" | "medium" | "high"; maxTokens?: number }): Promise<LLMResult<T>> {
    try {
      const b = this.base(o.effort);
      const msg = await this.client.beta.messages.stream({
        ...b,
        max_tokens: o.maxTokens ?? 32000,
        output_config: { ...b.output_config, format: { type: "json_schema", schema: o.schema } },
        system: o.system,
        messages: [{ role: "user", content: o.prompt }],
      }).finalMessage();
      check(msg);
      return { data: JSON.parse(textOf(msg)) as T, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens, model: msg.model };
    } catch (e) { wrap(e); }
  }

  async generateText(o: { system: string; messages: ChatMsg[]; effort?: "low" | "medium" | "high"; maxTokens?: number }): Promise<LLMResult<string>> {
    try {
      const msg = await this.client.beta.messages.stream({ ...this.base(o.effort), max_tokens: o.maxTokens ?? 16000, system: o.system, messages: o.messages }).finalMessage();
      check(msg);
      return { data: textOf(msg), inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens, model: msg.model };
    } catch (e) { wrap(e); }
  }

  async streamText(o: { system: string; messages: ChatMsg[]; onText: (t: string) => void; effort?: "low" | "medium" | "high" }): Promise<LLMResult<string>> {
    try {
      const stream = this.client.beta.messages.stream({ ...this.base(o.effort), max_tokens: 32000, system: o.system, messages: o.messages });
      stream.on("text", (t) => o.onText(t));
      const msg = await stream.finalMessage();
      check(msg);
      return { data: textOf(msg), inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens, model: msg.model };
    } catch (e) { wrap(e); }
  }
}
