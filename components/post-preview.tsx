"use client";
import { Heart, MessageCircle, Send, Bookmark, Repeat2, BarChart3, ThumbsUp, Share2 } from "lucide-react";
import { useT } from "./i18n";
import { fileUrl, type Asset } from "./media";

function Media({ m, aspect }: { m?: Asset; aspect: string }) {
  if (!m) return <div className={`grid ${aspect} place-items-center bg-muted text-xs text-subtle`}>—</div>;
  return m.mimeType.startsWith("video/") ? <video src={fileUrl(m.id)} className={`${aspect} w-full bg-black object-cover`} muted controls /> : <img src={fileUrl(m.id)} alt="" className={`${aspect} w-full object-cover`} />;
}

export function PostPreview({ v, media, account }: { v: { platform: string; format: string; text: string; title: string | null; hashtags: string[]; threadParts: string[]; pollOptions: string[] }; media: Asset[]; account?: { displayName: string; username?: string; avatarUrl?: string } }) {
  const t = useT();
  const name = account?.displayName ?? t("حسابك", "Your account"); const handle = account?.username ?? "account";
  const av = account?.avatarUrl ? <img src={account.avatarUrl} alt="" className="h-8 w-8 rounded-full" /> : <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-fuchsia-500" />;
  const caption = [v.text, v.hashtags.join(" ")].filter(Boolean).join("\n\n");
  if (v.platform === "x") return <div className="rounded-xl border border-border p-3 text-sm">
    {(v.format === "thread" && v.threadParts.length ? v.threadParts : [caption]).map((p, i) => <div key={i} className="flex gap-2 pb-3">{av}<div className="min-w-0 flex-1"><div className="text-xs"><b>{name}</b> <span className="text-subtle" dir="ltr">@{handle}</span></div><p className="whitespace-pre-wrap leading-6">{p}</p>
      {i === 0 && v.format === "poll" && <div className="mt-2 space-y-1">{v.pollOptions.map((o) => <div key={o} className="rounded-full border border-primary/40 px-3 py-1 text-center text-xs text-primary">{o}</div>)}</div>}
      {i === 0 && media[0] && v.format !== "poll" && <div className={`mt-2 grid gap-0.5 overflow-hidden rounded-xl ${media.length > 1 ? "grid-cols-2" : ""}`}>{media.slice(0, 4).map((m) => <Media key={m.id} m={m} aspect="aspect-video" />)}</div>}
      <div className="mt-2 flex justify-between text-subtle"><MessageCircle className="h-4 w-4" /><Repeat2 className="h-4 w-4" /><Heart className="h-4 w-4" /><BarChart3 className="h-4 w-4" /></div></div></div>)}
  </div>;
  if (v.platform === "instagram") {
    const story = v.format === "story" || v.format === "reel";
    return <div className="overflow-hidden rounded-xl border border-border text-sm">
      <div className="flex items-center gap-2 p-2">{av}<b className="text-xs">{handle}</b></div>
      <div className="relative"><Media m={media[0]} aspect={story ? "aspect-[9/16]" : media[0]?.width && media[0]?.height && media[0].height > media[0].width ? "aspect-[4/5]" : "aspect-square"} />{v.format === "carousel" && media.length > 1 && <span className="absolute end-2 top-2 rounded-full bg-black/60 px-2 text-xs text-white">1/{media.length}</span>}</div>
      {v.format !== "story" && <><div className="flex gap-3 p-2"><Heart className="h-5 w-5" /><MessageCircle className="h-5 w-5" /><Send className="h-5 w-5" /><Bookmark className="ms-auto h-5 w-5" /></div>
        <p className="line-clamp-6 whitespace-pre-wrap px-2 pb-3 text-xs leading-5"><b>{handle}</b> {caption}</p></>}
    </div>;
  }
  if (v.platform === "tiktok" || v.platform === "snapchat" || (v.platform === "youtube" && v.format === "short")) return <div className="relative mx-auto max-w-[240px] overflow-hidden rounded-2xl bg-black text-white">
    <Media m={media.find((m) => m.mimeType.startsWith("video/")) ?? media[0]} aspect="aspect-[9/16]" />
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-3 text-xs"><b dir="ltr">@{handle}</b><p className="mt-1 line-clamp-4 whitespace-pre-wrap">{v.platform === "youtube" ? v.title : caption}</p></div>
  </div>;
  if (v.platform === "youtube") return <div className="text-sm"><Media m={media.find((m) => m.mimeType.startsWith("image/")) ?? media[0]} aspect="aspect-video rounded-xl" />
    <div className="mt-2 flex gap-2">{av}<div><b className="line-clamp-2 leading-6">{v.title || t("عنوان الفيديو", "Video title")}</b><div className="text-xs text-subtle">{name}</div></div></div>
    <p className="mt-2 line-clamp-4 whitespace-pre-wrap rounded-lg bg-muted p-2 text-xs">{v.text}</p><div className="mt-2 flex gap-3 text-subtle"><ThumbsUp className="h-4 w-4" /><Share2 className="h-4 w-4" /></div></div>;
  return <div className="rounded-xl border border-border text-sm"><div className="border-b border-border p-3"><b>{v.title || t("(بدون عنوان)", "(no subject)")}</b><div className="text-xs text-subtle">{name}</div></div>
    {media[0] && <Media m={media[0]} aspect="aspect-[2/1]" />}<p className="whitespace-pre-wrap p-3 text-xs leading-6">{v.text}</p></div>;
}
