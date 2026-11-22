import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "./db";
import { storage } from "./storage";
import { saveAsset } from "./media";
import { notify } from "./notify";
import { tts } from "./ai/registry";
import { trackAIUsage } from "./plans";

const pexec = promisify(execFile);
const ff = (args: string[]) => pexec("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1024 * 1024 * 64 });

export const ASPECTS: Record<string, [number, number]> = { "9:16": [1080, 1920], "16:9": [1920, 1080], "1:1": [1080, 1080], "4:5": [1080, 1350] };

async function duration(file: string) {
  const { stdout } = await pexec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  return Number(stdout.trim()) || 0;
}
const srtTime = (s: number) => {
  const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(r).padStart(3, "0")}`;
};
export function buildSrt(items: { start: number; end: number; text: string }[]) {
  return items.filter((i) => i.text.trim()).map((i, n) => `${n + 1}\n${srtTime(i.start)} --> ${srtTime(i.end)}\n${i.text.trim()}\n`).join("\n");
}

/** Generates TTS voice-over for each scene (stored as audio assets). */
export async function generateVoiceover(videoId: string, userId?: string | null) {
  const v = await db.videoProject.findUniqueOrThrow({ where: { id: videoId }, include: { scenes: { orderBy: { order: "asc" } } } });
  const provider = await tts(v.workspaceId);
  for (const s of v.scenes) {
    if (!s.narration.trim()) continue;
    const audio = await provider.generate({ text: s.narration, voice: provider.voice, language: v.language });
    const asset = await saveAsset({ workspaceId: v.workspaceId, userId, name: `voice-${v.title.slice(0, 30)}-${s.order + 1}.mp3`, data: audio.data, mimeType: audio.mime, kind: "audio", source: "tts", tags: ["voiceover"] });
    await trackAIUsage(v.workspaceId, "tts");
    const dur = asset.durationSec ?? s.durationSec;
    await db.videoScene.update({ where: { id: s.id }, data: { voiceAssetId: asset.id, durationSec: Math.max(s.durationSec, Math.ceil((dur + 0.4) * 10) / 10) } });
  }
}

/** Renders a video project to MP4 with ffmpeg: per-scene Ken-Burns stills or clips, voice-over, music bed, burned subtitles. */
export async function renderVideo(videoId: string) {
  const v = await db.videoProject.findUniqueOrThrow({ where: { id: videoId }, include: { scenes: { orderBy: { order: "asc" } } } });
  const [W, H] = ASPECTS[v.aspectRatio] ?? ASPECTS["9:16"];
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ss-render-"));
  try {
    await db.videoProject.update({ where: { id: v.id }, data: { status: "rendering", renderError: null } });
    if (v.scenes.length === 0) throw new Error("لا توجد مشاهد في المشروع");
    const parts: string[] = []; const subs: { start: number; end: number; text: string }[] = []; let t = 0;
    const assetIds = v.scenes.flatMap((s) => [s.assetId, s.voiceAssetId]).filter(Boolean) as string[];
    const assets = new Map((await db.mediaAsset.findMany({ where: { id: { in: assetIds }, workspaceId: v.workspaceId } })).map((a) => [a.id, a]));
    for (const [i, s] of v.scenes.entries()) {
      const d = Math.max(1, s.durationSec);
      const out = path.join(tmp, `scene${i}.mp4`);
      const visual = s.assetId ? assets.get(s.assetId) : undefined;
      const voice = s.voiceAssetId ? assets.get(s.voiceAssetId) : undefined;
      const fit = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
      const fade = `fade=t=in:st=0:d=0.35,fade=t=out:st=${Math.max(0, d - 0.35)}:d=0.35`;
      const inputs: string[] = []; let vf: string;
      if (visual?.mimeType.startsWith("image/")) {
        inputs.push("-loop", "1", "-t", String(d), "-i", await storage().localPath(visual.storageKey));
        const frames = Math.ceil(d * 30);
        vf = `[0:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0009,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=30,setsar=1,${fade},format=yuv420p[v]`;
      } else if (visual?.mimeType.startsWith("video/")) {
        inputs.push("-stream_loop", "-1", "-t", String(d), "-i", await storage().localPath(visual.storageKey));
        vf = `[0:v]${fit},fps=30,${fade},format=yuv420p[v]`;
      } else {
        inputs.push("-f", "lavfi", "-t", String(d), "-i", `color=c=0x1f1b3a:s=${W}x${H}:r=30`);
        vf = `[0:v]${fade},format=yuv420p[v]`;
      }
      if (voice) inputs.push("-i", await storage().localPath(voice.storageKey));
      else inputs.push("-f", "lavfi", "-t", String(d), "-i", "anullsrc=r=44100:cl=stereo");
      await ff([...inputs, "-filter_complex", `${vf};[1:a]aresample=44100,apad,atrim=0:${d}[a]`, "-map", "[v]", "-map", "[a]", "-t", String(d), "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2", out]);
      parts.push(out);
      const caption = s.onScreenText.trim() || s.narration.trim();
      if (caption) subs.push({ start: t + 0.15, end: t + d - 0.1, text: caption });
      t += d;
    }
    const list = path.join(tmp, "list.txt");
    await fs.writeFile(list, parts.map((p) => `file '${p}'`).join("\n"));
    const joined = path.join(tmp, "joined.mp4");
    await ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);

    const srt = buildSrt(subs);
    const srtPath = path.join(tmp, "subs.srt"); await fs.writeFile(srtPath, srt);
    const fontSize = Math.round((W < H ? 15 : 20) * (v.aspectRatio === "9:16" ? 1 : 1));
    const style = `FontName=DejaVu Sans,FontSize=${fontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=2,Shadow=0,Alignment=2,MarginV=${W < H ? 38 : 18}`;
    const final = path.join(tmp, "final.mp4");
    const music = v.musicAssetId ? await db.mediaAsset.findFirst({ where: { id: v.musicAssetId, workspaceId: v.workspaceId } }) : null;
    const subFilter = `subtitles=${srtPath.replace(/:/g, "\\:")}:force_style='${style}'`;
    if (music) {
      await ff(["-i", joined, "-stream_loop", "-1", "-i", await storage().localPath(music.storageKey), "-filter_complex",
        `[0:v]${subFilter}[v];[1:a]volume=0.15,atrim=0:${t}[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=2[a]`,
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-c:a", "aac", "-movflags", "+faststart", "-t", String(t), final]);
    } else {
      await ff(["-i", joined, "-vf", subFilter, "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-c:a", "copy", "-movflags", "+faststart", final]);
    }
    const asset = await saveAsset({ workspaceId: v.workspaceId, name: `${v.title.slice(0, 60)}.mp4`, data: await fs.readFile(final), mimeType: "video/mp4", kind: "video", source: "video_render", tags: ["video-studio"] });
    await trackAIUsage(v.workspaceId, "video_render");
    await db.videoProject.update({ where: { id: v.id }, data: { status: "rendered", outputAssetId: asset.id, subtitlesSrt: srt } });
    await notify(v.workspaceId, { type: "video.done", title: `اكتمل إخراج الفيديو "${v.title}"`, link: `/video/${v.id}` });
    return asset;
  } catch (e) {
    const msg = (e as Error & { stderr?: string }).stderr?.slice(-800) || (e as Error).message;
    await db.videoProject.update({ where: { id: v.id }, data: { status: "failed", renderError: msg } });
    await notify(v.workspaceId, { type: "video.failed", title: `فشل إخراج الفيديو "${v.title}"`, body: msg.slice(0, 300), link: `/video/${v.id}` });
    throw e;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

/** Cuts a segment from a long video and reframes it to 9:16 (center crop), with optional burned subtitles. */
export async function cutClip(o: { workspaceId: string; assetId: string; start: number; end: number; title: string; segments?: { start: number; end: number; text: string }[] }) {
  const src = await db.mediaAsset.findFirstOrThrow({ where: { id: o.assetId, workspaceId: o.workspaceId } });
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ss-clip-"));
  try {
    const out = path.join(tmp, "clip.mp4");
    const dur = o.end - o.start;
    let vf = "scale=-2:1920,crop=1080:1920,setsar=1";
    const subs = (o.segments ?? []).filter((s) => s.end > o.start && s.start < o.end).map((s) => ({ start: Math.max(0, s.start - o.start), end: Math.min(dur, s.end - o.start), text: s.text }));
    if (subs.length) {
      const srtPath = path.join(tmp, "c.srt"); await fs.writeFile(srtPath, buildSrt(subs));
      vf += `,subtitles=${srtPath.replace(/:/g, "\\:")}:force_style='FontName=DejaVu Sans,FontSize=15,BorderStyle=3,Outline=2,MarginV=45'`;
    }
    await ff(["-ss", String(o.start), "-i", await storage().localPath(src.storageKey), "-t", String(dur), "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-c:a", "aac", "-movflags", "+faststart", out]);
    return saveAsset({ workspaceId: o.workspaceId, name: `${o.title.slice(0, 60)}.mp4`, data: await fs.readFile(out), mimeType: "video/mp4", kind: "video", source: "video_render", tags: ["clip", "short"], platforms: ["tiktok", "instagram", "youtube"] });
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
}

/** Extracts mono 16kHz audio (smaller upload for speech-to-text). */
export async function extractAudio(assetId: string, workspaceId: string) {
  const src = await db.mediaAsset.findFirstOrThrow({ where: { id: assetId, workspaceId } });
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ss-aud-"));
  try {
    const out = path.join(tmp, "a.mp3");
    await ff(["-i", await storage().localPath(src.storageKey), "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", out]);
    return { data: await fs.readFile(out), duration: await duration(out) };
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
}
