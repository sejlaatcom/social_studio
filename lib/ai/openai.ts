import { AIProviderError, type ChatMsg, type ImageProvider, type LLMProvider, type LLMResult, type STTProvider, type TTSProvider } from "./types";

const BASE = process.env.AI_OPENAI_BASE_URL || "https://api.openai.com/v1";

async function call(key: string, path: string, init: RequestInit): Promise<Response> {
  const r = await fetch(BASE + path, { ...init, headers: { Authorization: `Bearer ${key}`, ...(init.headers ?? {}) } });
  if (!r.ok) {
    const txt = await r.text();
    let msg = txt; try { msg = JSON.parse(txt).error?.message ?? txt; } catch { /* raw */ }
    throw new AIProviderError("openai", r.status === 401 ? "مفتاح OpenAI API غير صالح" : `OpenAI (${r.status}): ${msg.slice(0, 400)}`, r.status);
  }
  return r;
}

export class OpenAILLM implements LLMProvider {
  id = "openai";
  constructor(private key: string, public model = "gpt-5") {}
  private async complete(system: string, messages: ChatMsg[], responseFormat?: unknown) {
    const r = await call(this.key, "/chat/completions", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, messages: [{ role: "system", content: system }, ...messages], ...(responseFormat ? { response_format: responseFormat } : {}) }),
    });
    const j = await r.json();
    return { text: j.choices[0].message.content as string, inputTokens: j.usage?.prompt_tokens, outputTokens: j.usage?.completion_tokens, model: j.model as string };
  }
  async generateJSON<T>(o: { system: string; prompt: string; schema: Record<string, unknown> }): Promise<LLMResult<T>> {
    const r = await this.complete(o.system, [{ role: "user", content: o.prompt }], { type: "json_schema", json_schema: { name: "output", strict: true, schema: o.schema } });
    return { data: JSON.parse(r.text) as T, inputTokens: r.inputTokens, outputTokens: r.outputTokens, model: r.model };
  }
  async generateText(o: { system: string; messages: ChatMsg[] }): Promise<LLMResult<string>> {
    const r = await this.complete(o.system, o.messages);
    return { data: r.text, inputTokens: r.inputTokens, outputTokens: r.outputTokens, model: r.model };
  }
  async streamText(o: { system: string; messages: ChatMsg[]; onText: (t: string) => void }): Promise<LLMResult<string>> {
    const r = await this.generateText(o); o.onText(r.data); return r;
  }
}

export class OpenAIImage implements ImageProvider {
  id = "openai";
  constructor(private key: string, public model = "gpt-image-1") {}
  async generate({ prompt, size }: { prompt: string; size: { width: number; height: number } }) {
    const ratio = size.width / size.height;
    const s = ratio > 1.2 ? "1536x1024" : ratio < 0.83 ? "1024x1536" : "1024x1024";
    const r = await call(this.key, "/images/generations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: this.model, prompt, size: s, n: 1 }) });
    const j = await r.json();
    const b64 = j.data?.[0]?.b64_json;
    if (b64) return { data: Buffer.from(b64, "base64"), mime: "image/png" };
    const url = j.data?.[0]?.url;
    if (!url) throw new AIProviderError("openai", "لم يُرجع مزود الصور أي صورة");
    return { data: Buffer.from(await (await fetch(url)).arrayBuffer()), mime: "image/png" };
  }
}

export class OpenAITTS implements TTSProvider {
  id = "openai";
  constructor(private key: string, private model = "gpt-4o-mini-tts") {}
  async generate({ text, voice }: { text: string; voice?: string }) {
    const r = await call(this.key, "/audio/speech", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: this.model, voice: voice || "alloy", input: text, response_format: "mp3" }) });
    return { data: Buffer.from(await r.arrayBuffer()), mime: "audio/mpeg" };
  }
}

export class OpenAISTT implements STTProvider {
  id = "openai";
  constructor(private key: string, private model = "whisper-1") {}
  async transcribe({ file, filename, language }: { file: Buffer; filename: string; language?: string }) {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(file)]), filename);
    fd.append("model", this.model);
    fd.append("response_format", "verbose_json");
    if (language) fd.append("language", language);
    const r = await call(this.key, "/audio/transcriptions", { method: "POST", body: fd });
    const j = await r.json();
    return { text: j.text as string, segments: (j.segments ?? []).map((s: { start: number; end: number; text: string }) => ({ start: s.start, end: s.end, text: s.text.trim() })) };
  }
}
