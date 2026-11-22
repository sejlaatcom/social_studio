export type ChatMsg = { role: "user" | "assistant"; content: string };
export type JsonSchema = Record<string, unknown>;

export interface LLMResult<T> { data: T; inputTokens?: number; outputTokens?: number; model: string }

export interface LLMProvider {
  id: string;
  model: string;
  generateJSON<T>(opts: { system: string; prompt: string; schema: JsonSchema; effort?: "low" | "medium" | "high"; maxTokens?: number }): Promise<LLMResult<T>>;
  generateText(opts: { system: string; messages: ChatMsg[]; effort?: "low" | "medium" | "high"; maxTokens?: number }): Promise<LLMResult<string>>;
  streamText(opts: { system: string; messages: ChatMsg[]; onText: (t: string) => void; effort?: "low" | "medium" | "high" }): Promise<LLMResult<string>>;
}

export type ImageSize = { width: number; height: number };
export interface ImageProvider { id: string; model: string; generate(opts: { prompt: string; size: ImageSize }): Promise<{ data: Buffer; mime: string }> }
export interface TTSProvider { id: string; generate(opts: { text: string; voice?: string; language?: string }): Promise<{ data: Buffer; mime: string }> }
export interface STTProvider { id: string; transcribe(opts: { file: Buffer; filename: string; language?: string }): Promise<{ text: string; segments: { start: number; end: number; text: string }[] }> }

export class AIProviderError extends Error {
  constructor(public provider: string, message: string, public status?: number) { super(message); }
}
