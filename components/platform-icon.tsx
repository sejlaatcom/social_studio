import clsx from "clsx";

const P: Record<string, { bg: string; svg: React.ReactNode }> = {
  instagram: { bg: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]", svg: <><rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="2" /><circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" strokeWidth="2" /><circle cx="16.3" cy="7.7" r="1" fill="#fff" /></> },
  x: { bg: "bg-black", svg: <path d="M6 5h3.2l3.3 4.6L16.4 5H18l-4.7 5.6L18.5 19h-3.2l-3.6-5-4.2 5H6l5-6z" fill="#fff" /> },
  tiktok: { bg: "bg-black", svg: <path d="M13.5 4h2.4c.2 1.8 1.4 3.1 3.1 3.3v2.4a5.6 5.6 0 0 1-3.1-1v5.9A4.6 4.6 0 1 1 11.3 10v2.5a2.2 2.2 0 1 0 2.2 2.1z" fill="#fff" /> },
  youtube: { bg: "bg-[#ff0000]", svg: <path d="M10 8.5v7l6-3.5z" fill="#fff" /> },
  snapchat: { bg: "bg-[#FFFC00]", svg: <path d="M12 4.5c2.6 0 4.2 2 4.2 4.4v1.8l1.3-.4c.5 0 .6.6.2.8l-1.5.7c.4 1.5 1.6 2.6 3 3-.2.6-1.2.8-2 .9l-.3 1-1.6-.2c-.9.4-1.7 1.4-3.3 1.4s-2.4-1-3.3-1.4l-1.6.2-.3-1c-.8-.1-1.8-.3-2-.9 1.4-.4 2.6-1.5 3-3l-1.5-.7c-.4-.2-.3-.8.2-.8l1.3.4V8.9c0-2.4 1.6-4.4 4.2-4.4z" fill="#fff" stroke="#111" strokeWidth=".9" /> },
  gmail: { bg: "bg-white border border-border", svg: <><path d="M4.5 7.5v9h3v-6l4.5 3.4 4.5-3.4v6h3v-9l-7.5 5.6z" fill="#EA4335" /></> },
};

export function PlatformIcon({ platform, size = 20, className }: { platform: string; size?: number; className?: string }) {
  const p = P[platform]; if (!p) return null;
  return <span className={clsx("inline-grid shrink-0 place-items-center rounded-md", p.bg, className)} style={{ width: size, height: size }}>
    <svg viewBox="0 0 24 24" width={size * 0.85} height={size * 0.85} aria-label={platform}>{p.svg}</svg>
  </span>;
}
export const PLATFORM_LABEL: Record<string, [string, string]> = {
  instagram: ["إنستغرام", "Instagram"], x: ["إكس", "X"], tiktok: ["تيك توك", "TikTok"], youtube: ["يوتيوب", "YouTube"], snapchat: ["سناب شات", "Snapchat"], gmail: ["جيميل", "Gmail"],
};
