// TEST HARNESS ONLY — emulates the Anthropic Messages API (SSE streaming) and a few OpenAI endpoints
// so the full AI pipeline can be exercised end-to-end without real API keys.
// Usage: node tests/mocks/mock-ai-server.mjs 4010   then AI_ANTHROPIC_BASE_URL=http://127.0.0.1:4010 AI_OPENAI_BASE_URL=http://127.0.0.1:4010/v1
import http from "node:http";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const port = Number(process.argv[2] ?? 4010);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mockai-"));
execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-ac", "1", path.join(tmp, "a.mp3")]);
execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "color=c=0x3355aa:s=1024x1024", "-frames:v", "1", path.join(tmp, "i.png")]);
const MP3 = fs.readFileSync(path.join(tmp, "a.mp3")); const PNG = fs.readFileSync(path.join(tmp, "i.png"));
const log = [];

function fill(schema, key = "", idx = 0) {
  if (schema.enum) return schema.enum[0];
  switch (schema.type) {
    case "object": return Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, fill(v, k, idx)]));
    case "array": return Array.from({ length: 3 }, (_, i) => fill(schema.items, key, i));
    case "number": return key === "durationSec" ? 3 : key === "dayOffset" ? idx : key === "start" ? idx * 20 : key === "end" ? idx * 20 + 15 : key === "week" ? idx + 1 : 1;
    case "boolean": return false;
    default:
      if (key === "platform" || key === "platforms") return ["instagram", "x", "tiktok"][idx % 3];
      if (key === "time") return "19:00"; if (key === "format") return "post"; if (key === "contentType") return "educational";
      if (/^(background|backgroundAlt|primary|text|accent)$/.test(key)) return ["#1e1b4b", "#6d28d9", "#f59e0b", "#ffffff", "#ef4444"][["background", "backgroundAlt", "primary", "text", "accent"].indexOf(key)];
      if (key === "hashtags" || key === "tags") return `#وسم_${idx + 1}`;
      return `نص تجريبي (${key}) رقم ${idx + 1}`;
  }
}

function sse(res, text, model) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  ev("message_start", { message: { id: "msg_mock", type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 42, output_tokens: 1 } } });
  ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
  for (let i = 0; i < text.length; i += 40) ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: text.slice(i, i + 40) } });
  ev("content_block_stop", { index: 0 });
  ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: Math.ceil(text.length / 4) } });
  ev("message_stop", {}); res.end();
}

http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const url = req.url.split("?")[0];
  if (url === "/__log") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(log)); }
  if (url === "/v1/messages") {
    const b = JSON.parse(body); log.push({ path: url, model: b.model, thinking: b.thinking, effort: b.output_config?.effort, hasSchema: !!b.output_config?.format, fallbacks: b.fallbacks, beta: req.headers["anthropic-beta"], stream: b.stream, key: (req.headers["x-api-key"] ?? req.headers.authorization)?.slice(0, 12) });
    if (req.headers["x-api-key"] !== "sk-ant-mock" && req.headers.authorization !== "Bearer sk-ant-mock") { res.writeHead(401, { "content-type": "application/json" }); return res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } })); }
    const text = b.output_config?.format ? JSON.stringify(fill(b.output_config.format.schema)) : `## رد تجريبي\n\nهذا رد من الخادم الوهمي على: **${b.messages.at(-1).content.slice(0, 40)}**\n\n- نقطة أولى\n- نقطة ثانية`;
    return sse(res, text, b.model);
  }
  if (url === "/v1/images/generations") { log.push({ path: url }); res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ data: [{ b64_json: PNG.toString("base64") }] })); }
  if (url === "/v1/audio/speech") { log.push({ path: url }); res.writeHead(200, { "content-type": "audio/mpeg" }); return res.end(MP3); }
  if (url === "/v1/audio/transcriptions") { log.push({ path: url }); res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ text: "مرحبا بكم", segments: Array.from({ length: 6 }, (_, i) => ({ start: i * 5, end: i * 5 + 5, text: `جملة رقم ${i + 1}` })) })); }
  res.writeHead(404); res.end("not found");
}).listen(port, "127.0.0.1", () => console.log(`mock ai on ${port}`));
