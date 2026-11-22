import { db } from "../db";
import { checkLimit, trackAIUsage } from "../plans";
import { AppError } from "../errors";
import { llm } from "./registry";
import { AIProviderError, type ChatMsg } from "./types";
import * as S from "./schemas";

type Who = { workspaceId: string; userId?: string | null };

export const TONES: Record<string, [string, string]> = {
  formal: ["رسمي", "Formal"], marketing: ["تسويقي", "Marketing"], professional: ["احترافي", "Professional"],
  friendly: ["ودود", "Friendly"], educational: ["تعليمي", "Educational"], entertaining: ["ترفيهي", "Entertaining"],
  creative: ["إبداعي", "Creative"], enthusiastic: ["حماسي", "Enthusiastic"], concise: ["مختصر", "Concise"], detailed: ["تفصيلي", "Detailed"],
};
export const DIALECTS: Record<string, string> = {
  msa: "العربية الفصحى المعاصرة", gulf: "اللهجة الخليجية", saudi: "اللهجة السعودية (نجدية/حجازية حسب السياق)",
  egyptian: "اللهجة المصرية", levantine: "اللهجة الشامية", maghrebi: "اللهجة المغاربية", iraqi: "اللهجة العراقية", en: "English",
};

export async function brandContext(workspaceId: string, brandKitId?: string | null) {
  const b = brandKitId
    ? await db.brandKit.findFirst({ where: { id: brandKitId, workspaceId } })
    : await db.brandKit.findFirst({ where: { workspaceId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  if (!b) return { brand: null, text: "لا توجد هوية تجارية محددة؛ اكتب بأسلوب احترافي عام." };
  const colors = (b.colors as { name: string; hex: string }[]).map((c) => `${c.name} ${c.hex}`).join("، ");
  const lines = [
    `اسم العلامة: ${b.name}`, b.description && `الوصف: ${b.description}`, b.toneOfVoice && `نبرة الكتابة: ${b.toneOfVoice}`,
    b.audience && `الجمهور المستهدف: ${b.audience}`, b.products && `المنتجات: ${b.products}`, b.services && `الخدمات: ${b.services}`,
    b.values && `القيم: ${b.values}`, b.website && `الموقع: ${b.website}`, colors && `الألوان الرسمية: ${colors}`,
    b.dialect && `اللهجة المفضلة: ${DIALECTS[b.dialect] ?? b.dialect}`, b.hashtags.length && `هاشتاقات العلامة: ${b.hashtags.join(" ")}`,
    b.forbiddenWords.length && `كلمات ممنوعة لا تستخدمها أبدًا: ${b.forbiddenWords.join("، ")}`,
  ].filter(Boolean);
  return { brand: b, text: lines.join("\n") };
}

const BASE_SYSTEM = `أنت خبير تسويق رقمي وكاتب محتوى محترف لمنصات التواصل الاجتماعي في العالم العربي.
- تكتب عربية سليمة وطبيعية ومقنعة، وتراعي اللهجة المطلوبة بدقة، وتكتب بالإنجليزية بإتقان عند الطلب.
- تعيد ابتكار المحتوى لكل منصة بحسب ثقافة جمهورها وحدودها التقنية، ولا تنسخ النص نفسه بين المنصات.
- لا تخترع أرقامًا أو إحصاءات أو ادعاءات عن المنتج غير موجودة في المدخلات أو الهوية التجارية.
- الهاشتاقات تبدأ بـ # وبدون مسافات داخلها.`;

async function run<T>(who: Who, kind: string, prompt: string, fn: () => Promise<{ data: T; inputTokens?: number; outputTokens?: number; model: string }>): Promise<T> {
  await checkLimit(who.workspaceId, "aiTextRequests");
  const provider = await llm(who.workspaceId);
  const req = await db.aIRequest.create({ data: { workspaceId: who.workspaceId, userId: who.userId ?? null, kind, provider: provider.id, model: provider.model, prompt: prompt.slice(0, 8000) } });
  const t0 = Date.now();
  try {
    const r = await fn();
    await db.aIRequest.update({ where: { id: req.id }, data: { status: "succeeded", output: r.data as object, inputTokens: r.inputTokens, outputTokens: r.outputTokens, latencyMs: Date.now() - t0, model: r.model } });
    await trackAIUsage(who.workspaceId, kind, r.inputTokens, r.outputTokens);
    return r.data;
  } catch (e) {
    await db.aIRequest.update({ where: { id: req.id }, data: { status: "failed", error: (e as Error).message, latencyMs: Date.now() - t0 } });
    if (e instanceof AIProviderError) throw new AppError(502, "ai_error", e.message);
    throw e;
  }
}

function langLine(language: string, dialect?: string) {
  if (language === "en") return "اكتب المحتوى كاملًا باللغة الإنجليزية.";
  return `اكتب المحتوى بالعربية مستخدمًا: ${DIALECTS[dialect ?? "msa"] ?? DIALECTS.msa}.`;
}

export type ContentPack = {
  headline: string; body: string; shortVersion: string; longVersion: string; cta: string; hashtags: string[];
  imageIdeas: string[]; videoIdeas: string[];
  instagram: { caption: string; hashtags: string[]; altText: string }; reel: { hook: string; script: string; caption: string };
  story: { frames: string[] }; x: { post: string; thread: string[] };
  tiktok: { hook: string; script: string; caption: string; hashtags: string[] };
  youtube: { title: string; description: string; tags: string[]; shortsScript: string; thumbnailText: string };
  snapchat: { storyText: string; frames: string[] }; email: { subject: string; preheader: string; headline: string; body: string; ctaLabel: string };
};

export async function generateContentPack(who: Who, o: { idea: string; tone: string; language: string; dialect?: string; brandKitId?: string | null }) {
  const { text: brand } = await brandContext(who.workspaceId, o.brandKitId);
  const prompt = `الفكرة: ${o.idea}
الأسلوب: ${TONES[o.tone]?.[0] ?? o.tone}
${langLine(o.language, o.dialect)}

الهوية التجارية:
${brand}

أنشئ حزمة محتوى متكاملة:
- headline عنوان جذاب، body المنشور الأساسي، shortVersion نسخة مختصرة، longVersion نسخة مطولة، cta دعوة لاتخاذ إجراء، hashtags (8-15).
- imageIdeas: 3-5 أفكار صور موصوفة بصريًا بدقة (تصلح كبرومبت لتوليد صور)، videoIdeas: 3-5 أفكار فيديو.
- instagram: caption (≤2200 حرف، فقرات قصيرة وإيموجي باعتدال) + hashtags (≤30) + altText وصف بديل للصورة.
- reel: hook لأول 3 ثوانٍ + script بمشاهد قصيرة + caption.
- story: 3-5 إطارات قصيرة جدًا.
- x: post ≤ 270 حرفًا + thread من 4-7 تغريدات كل واحدة ≤ 270 حرفًا ومرقّمة.
- tiktok: hook قوي، script بأسلوب TikTok السريع، caption، hashtags.
- youtube: title ≤ 100 حرف، description مفصل مع فقرات وطوابع زمنية مقترحة، tags (10-15)، shortsScript لفيديو Shorts ≤ 60 ثانية، thumbnailText ≤ 5 كلمات.
- snapchat: storyText قصير جدًا وframes إطارات عمودية.
- email: subject، preheader، headline، body (نص عادي بفقرات)، ctaLabel.`;
  return run<ContentPack>(who, "text", prompt, async () => (await llm(who.workspaceId)).generateJSON<ContentPack>({ system: BASE_SYSTEM, prompt, schema: S.contentPackSchema, effort: "medium" }));
}

export async function rewrite(who: Who, o: { text: string; instruction: string; language?: string; platform?: string; count?: number }) {
  const prompt = `النص الأصلي:
"""${o.text}"""

المطلوب: ${o.instruction}
${o.platform ? `المنصة المستهدفة: ${o.platform}` : ""}
${o.language === "en" ? "Write the output in English." : "حافظ على لغة النص الأصلي ولهجته ما لم يُطلب غير ذلك."}
أعد ${o.count ?? 3} صيغ مختلفة، لكل صيغة label قصير يصف أسلوبها.`;
  return run<{ variants: { label: string; text: string }[] }>(who, "text", prompt, async () => (await llm(who.workspaceId)).generateJSON({ system: BASE_SYSTEM, prompt, schema: S.rewriteSchema, effort: "low" }));
}

export type CampaignPlan = { summary: string; strategy: string; weeks: { week: number; theme: string; posts: { dayOffset: number; time: string; platform: string; format: string; contentType: string; title: string; text: string; hashtags: string[]; visualIdea: string }[] }[] };

export async function campaignPlan(who: Who, campaignId: string) {
  const c = await db.campaign.findFirstOrThrow({ where: { id: campaignId, workspaceId: who.workspaceId } });
  const { text: brand } = await brandContext(who.workspaceId, c.brandKitId);
  const days = c.startDate && c.endDate ? Math.max(1, Math.round((+c.endDate - +c.startDate) / 86400000) + 1) : 28;
  const prompt = `أنشئ خطة حملة تسويقية متكاملة.
اسم الحملة: ${c.name}
الهدف: ${c.goal ?? "-"}
الجمهور: ${c.audience ?? "-"}
مدة الحملة: ${days} يومًا (dayOffset يبدأ من 0 وأقصاه ${days - 1})
المنصات: ${c.platforms.join(", ")}  (استخدم المعرفات كما هي: instagram, x, tiktok, youtube, snapchat, gmail)
${c.budget ? `الميزانية: ${c.budget} ${c.currency}` : ""}
المنتجات: ${c.products ?? "-"}
الرسائل الرئيسية: ${c.keyMessages ?? "-"}
CTA: ${c.cta ?? "-"}
الهوية البصرية: ${c.visualIdentity ?? "-"}
عدد المنشورات المستهدف: ${c.targetPostCount ?? "حسب ما تراه مناسبًا"}

الهوية التجارية:
${brand}

المطلوب: summary، strategy (توزيع المحتوى وأنواعه)، وweeks (خطة أسبوعية) ولكل منشور: dayOffset، time (HH:MM بتوقيت الجمهور)، platform، format (post|carousel|reel|story|thread|video|short|email)، contentType (educational|promotional|engagement|announcement|behind_the_scenes|testimonial)، title، text (النص الكامل الجاهز للنشر والمناسب للمنصة)، hashtags، visualIdea.`;
  return run<CampaignPlan>(who, "text", prompt, async () => (await llm(who.workspaceId)).generateJSON({ system: BASE_SYSTEM, prompt, schema: S.campaignPlanSchema, effort: "medium", maxTokens: 64000 }));
}

export async function generateIdeas(who: Who, o: { topic: string; count: number; language: string; dialect?: string }) {
  const { text: brand } = await brandContext(who.workspaceId);
  const prompt = `اقترح ${o.count} فكرة محتوى حول: ${o.topic}\n${langLine(o.language, o.dialect)}\nالهوية:\n${brand}\nلكل فكرة: title، body (وصف تنفيذي 2-3 جمل)، platforms (من: instagram,x,tiktok,youtube,snapchat,gmail)، contentType.`;
  return run<{ ideas: { title: string; body: string; platforms: string[]; contentType: string }[] }>(who, "text", prompt, async () => (await llm(who.workspaceId)).generateJSON({ system: BASE_SYSTEM, prompt, schema: S.ideasSchema, effort: "low" }));
}

export async function designCopy(who: Who, o: { prompt: string; width: number; height: number; language: string }) {
  const { text: brand } = await brandContext(who.workspaceId);
  const prompt = `صمم نصوص وألوان تصميم سوشيال ميديا بمقاس ${o.width}x${o.height}.
الطلب: ${o.prompt}
${o.language === "en" ? "Text in English." : "النصوص بالعربية."}
الهوية: ${brand}
- headline ≤ 6 كلمات قوية، subheadline ≤ 14 كلمة، cta ≤ 3 كلمات، badge ≤ 3 كلمات (مثل "خصم 20%") أو نص فارغ.
- backgroundPrompt: وصف بالإنجليزية لصورة خلفية احترافية بدون أي نصوص أو حروف داخل الصورة.
- palette ألوان HEX متناسقة مع الهوية وتباين قراءة عالٍ بين text وbackground.
- layout: centered | split | bold | minimal.`;
  return run<{ headline: string; subheadline: string; cta: string; badge: string; backgroundPrompt: string; palette: { background: string; backgroundAlt: string; primary: string; text: string; accent: string }; layout: string }>(
    who, "text", prompt, async () => (await llm(who.workspaceId)).generateJSON({ system: BASE_SYSTEM, prompt, schema: S.designSchema, effort: "low" }));
}

export type VideoScript = { title: string; hook: string; intro: string; outro: string; caption: string; hashtags: string[]; scenes: { narration: string; onScreenText: string; visualPrompt: string; durationSec: number }[] };
export async function videoScript(who: Who, o: { topic: string; videoType: string; aspectRatio: string; durationSec: number; language: string; dialect?: string; sourceText?: string }) {
  const { text: brand } = await brandContext(who.workspaceId);
  const prompt = `اكتب سيناريو فيديو ${o.videoType} بنسبة ${o.aspectRatio} ومدته الإجمالية قرابة ${o.durationSec} ثانية.
الموضوع: ${o.topic}
${o.sourceText ? `حوّل النص التالي إلى فيديو:\n"""${o.sourceText.slice(0, 20000)}"""` : ""}
${langLine(o.language, o.dialect)}
الهوية: ${brand}
- hook: جملة جذب قوية لأول 3 ثوانٍ (وتكون المشهد الأول).
- scenes: من 4 إلى 12 مشهدًا؛ narration نص التعليق الصوتي، onScreenText نص قصير يظهر على الشاشة (≤ 7 كلمات)، visualPrompt وصف بصري بالإنجليزية لتوليد صورة المشهد بدون نصوص، durationSec بحيث يتناسب مع طول التعليق (~2.5 كلمة/ثانية).
- intro وoutro قصيرين (الخاتمة تتضمن CTA)، caption ووصف وhashtags للنشر.`;
  return run<VideoScript>(who, "video_script", prompt, async () => (await llm(who.workspaceId)).generateJSON({ system: BASE_SYSTEM, prompt, schema: S.videoScriptSchema, effort: "medium" }));
}

export async function suggestReplies(who: Who, o: { text: string; author: string; platform: string }) {
  const { text: brand } = await brandContext(who.workspaceId);
  const prompt = `تعليق/رسالة من ${o.author} على ${o.platform}:\n"""${o.text}"""\nالهوية:\n${brand}\nصنّف الرسالة (category, priority, needsFollowUp) واقترح 3 ردود مهذبة ومختصرة بلغة ولهجة المرسل وبنبرة العلامة.`;
  return run<{ category: string; priority: string; needsFollowUp: boolean; replies: string[] }>(who, "text", prompt, async () => (await llm(who.workspaceId)).generateJSON({ system: BASE_SYSTEM, prompt, schema: S.replySchema, effort: "low" }));
}

export async function analyticsInsights(who: Who, data: unknown) {
  const prompt = `هذه بيانات أداء فعلية مسحوبة من منصات التواصل (JSON):\n${JSON.stringify(data).slice(0, 60000)}\n
حلّل البيانات فقط دون افتراض أرقام غير موجودة. إن كانت البيانات قليلة فاذكر ذلك صراحة.
summary: ملخص من 2-3 جمل. insights: ملاحظات مبنية على الأرقام (اذكر الأرقام). recommendations: توصيات عملية قابلة للتنفيذ.`;
  return run<{ summary: string; insights: string[]; recommendations: string[] }>(who, "analysis", prompt, async () => (await llm(who.workspaceId)).generateJSON({ system: BASE_SYSTEM, prompt, schema: S.insightsSchema, effort: "medium" }));
}

export async function suggestClips(who: Who, o: { segments: { start: number; end: number; text: string }[]; count: number; maxSec: number }) {
  const prompt = `هذا نص مفرغ لفيديو طويل مع الطوابع الزمنية:\n${o.segments.map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join("\n").slice(0, 80000)}\n
اختر ${o.count} مقاطع قصيرة قوية تصلح كـ Shorts/Reels/TikTok، مدة كل مقطع بين 15 و${o.maxSec} ثانية، ويبدأ وينتهي عند حدود الجمل. أعد start وend بالثواني، وtitle وhook.`;
  return run<{ clips: { start: number; end: number; title: string; hook: string }[] }>(who, "analysis", prompt, async () => (await llm(who.workspaceId)).generateJSON({ system: BASE_SYSTEM, prompt, schema: S.clipsSchema, effort: "medium" }));
}

export async function emailContent(who: Who, o: { goal: string; kind: string; language: string; dialect?: string }) {
  const { text: brand } = await brandContext(who.workspaceId);
  const prompt = `اكتب رسالة بريد إلكتروني تسويقية من نوع: ${o.kind}\nالهدف: ${o.goal}\n${langLine(o.language, o.dialect)}\nالهوية:\n${brand}\nأعد subject (≤ 60 حرفًا)، preheader، headline، paragraphs (2-4 فقرات)، ctaLabel، footer.`;
  return run<{ subject: string; preheader: string; headline: string; paragraphs: string[]; ctaLabel: string; footer: string }>(who, "text", prompt, async () => (await llm(who.workspaceId)).generateJSON({ system: BASE_SYSTEM, prompt, schema: S.emailSchema, effort: "low" }));
}

/** Assistant chat (streaming). Context: brand + live workspace facts from the DB. */
export async function assistantStream(who: Who, messages: ChatMsg[], onText: (t: string) => void) {
  const { text: brand } = await brandContext(who.workspaceId);
  const facts = await workspaceFacts(who.workspaceId);
  const system = `${BASE_SYSTEM}

أنت "المساعد التسويقي" داخل منصة استوديو المحتوى الذكي. تساعد المستخدم في خطط المحتوى والأفكار والإعلانات وتحليل الأداء.
- عند تحليل الأداء اعتمد فقط على البيانات الفعلية أدناه. إن لم تتوفر بيانات كافية فقل ذلك بوضوح واقترح ربط الحسابات أو مزامنتها.
- نسّق ردودك بـ Markdown بسيط (عناوين، قوائم، جداول عند الحاجة).

الهوية التجارية:
${brand}

بيانات مساحة العمل الحالية (حقيقية من قاعدة البيانات):
${JSON.stringify(facts)}`;
  const last = messages[messages.length - 1]?.content ?? "";
  return run<string>(who, "chat", last, async () => (await llm(who.workspaceId)).streamText({ system, messages, onText, effort: "medium" }));
}

export async function workspaceFacts(workspaceId: string) {
  const since = new Date(Date.now() - 90 * 86400000);
  const [accounts, postsByStatus, recentPublished, snapshots] = await Promise.all([
    db.socialAccount.findMany({ where: { workspaceId, status: { not: "disconnected" } }, select: { platform: true, displayName: true, followers: true, status: true } }),
    db.post.groupBy({ by: ["status"], where: { workspaceId }, _count: true }),
    db.postVariant.findMany({
      where: { post: { workspaceId }, status: "published", publishedAt: { gte: since } },
      select: { platform: true, format: true, text: true, publishedAt: true, post: { select: { contentType: true, title: true } },
        analytics: { orderBy: { capturedAt: "desc" }, take: 1, select: { views: true, likes: true, comments: true, shares: true, saves: true, reach: true, impressions: true } } },
      orderBy: { publishedAt: "desc" }, take: 60,
    }),
    db.analyticsSnapshot.findMany({ where: { workspaceId, scope: "account", capturedAt: { gte: since } }, orderBy: { capturedAt: "asc" }, select: { socialAccount: { select: { platform: true } }, capturedAt: true, followers: true } }),
  ]);
  return {
    connectedAccounts: accounts,
    postsByStatus: Object.fromEntries(postsByStatus.map((p) => [p.status, p._count])),
    publishedLast90Days: recentPublished.map((v) => ({ platform: v.platform, format: v.format, contentType: v.post.contentType, title: v.post.title, publishedAt: v.publishedAt, metrics: v.analytics[0] ?? null, excerpt: v.text.slice(0, 140) })),
    followerHistory: snapshots.map((s) => ({ platform: s.socialAccount.platform, at: s.capturedAt, followers: s.followers })),
  };
}
