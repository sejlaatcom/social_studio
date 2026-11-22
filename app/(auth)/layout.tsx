import { Sparkles } from "lucide-react";
import { getLocale } from "@/lib/locale";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const ar = (await getLocale()) === "ar";
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center p-6">{children}</div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#1b1446] via-[#2a1d74] to-[#6d5dfc] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -end-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 start-10 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative flex items-center gap-2 font-bold"><Sparkles className="h-5 w-5" />{ar ? "استوديو المحتوى الذكي" : "AI Social Studio"}</div>
        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight">{ar ? "من فكرة واحدة إلى محتوى متكامل عبر جميع منصاتك." : "From one idea to complete content across all your platforms."}</h2>
          <ol className="mt-8 space-y-3 text-white/80">
            {(ar ? ["اكتب فكرتك", "ابتكر المحتوى بالذكاء الاصطناعي", "أنشئ التصميم والفيديو", "راجع واجدول أو انشر", "حلّل النتائج الفعلية"] : ["Write your idea", "Generate content with AI", "Create designs & videos", "Review, schedule or publish", "Analyze real results"]).map((s, i) => (
              <li key={i} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-sm">{i + 1}</span>{s}</li>
            ))}
          </ol>
        </div>
        <p className="relative text-sm text-white/60">Instagram · X · TikTok · YouTube · Snapchat · Gmail</p>
      </div>
    </div>
  );
}
