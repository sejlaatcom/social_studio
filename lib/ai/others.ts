import { AIProviderError, type ImageProvider, type TTSProvider } from "./types";

export class StabilityImage implements ImageProvider {
  id = "stability";
  constructor(private key: string, public model = "core") {}
  async generate({ prompt, size }: { prompt: string; size: { width: number; height: number } }) {
    const ratios: [string, number][] = [["1:1", 1], ["16:9", 16 / 9], ["9:16", 9 / 16], ["4:5", 0.8], ["5:4", 1.25], ["3:2", 1.5], ["2:3", 2 / 3]];
    const target = size.width / size.height;
    const aspect = ratios.reduce((a, b) => (Math.abs(b[1] - target) < Math.abs(a[1] - target) ? b : a))[0];
    const fd = new FormData();
    fd.append("prompt", prompt); fd.append("aspect_ratio", aspect); fd.append("output_format", "png");
    const r = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${this.model}`, { method: "POST", headers: { Authorization: `Bearer ${this.key}`, Accept: "image/*" }, body: fd });
    if (!r.ok) throw new AIProviderError("stability", `Stability (${r.status}): ${(await r.text()).slice(0, 300)}`, r.status);
    return { data: Buffer.from(await r.arrayBuffer()), mime: "image/png" };
  }
}

export class ElevenLabsTTS implements TTSProvider {
  id = "elevenlabs";
  constructor(private key: string, private defaultVoice = "21m00Tcm4TlvDq8ikWAM") {}
  async generate({ text, voice }: { text: string; voice?: string }) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice || this.defaultVoice}`, {
      method: "POST", headers: { "xi-api-key": this.key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
    });
    if (!r.ok) throw new AIProviderError("elevenlabs", `ElevenLabs (${r.status}): ${(await r.text()).slice(0, 300)}`, r.status);
    return { data: Buffer.from(await r.arrayBuffer()), mime: "audio/mpeg" };
  }
}
