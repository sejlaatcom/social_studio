export type Platform = "gmail" | "instagram" | "x" | "snapchat" | "tiktok" | "youtube";
export const PLATFORMS: Platform[] = ["instagram", "x", "tiktok", "youtube", "snapchat", "gmail"];

export type Capability = { supported: boolean; note?: string };
export type PlatformInfo = {
  id: Platform; name: string; nameAr: string; color: string; provider: string;
  textLimit: number; hashtagLimit?: number; formats: string[];
  capabilities: { publish: Capability; schedule: Capability; analytics: Capability; comments: Capability; messages: Capability };
};

export const PLATFORM_INFO: Record<Platform, PlatformInfo> = {
  instagram: {
    id: "instagram", name: "Instagram", nameAr: "إنستغرام", color: "#E1306C", provider: "instagram",
    textLimit: 2200, hashtagLimit: 30, formats: ["post", "carousel", "reel", "story"],
    capabilities: {
      publish: { supported: true, note: "حسابات Business/Creator فقط عبر Instagram Graph API (الصور، Carousel، Reels، Stories)." },
      schedule: { supported: true, note: "الجدولة تتم عبر خادم المنصة ثم النشر في الموعد." },
      analytics: { supported: true }, comments: { supported: true },
      messages: { supported: false, note: "الرسائل الخاصة تتطلب Advanced Access ومراجعة Meta؛ غير مفعّلة." },
    },
  },
  x: {
    id: "x", name: "X", nameAr: "إكس (تويتر)", color: "#111111", provider: "x",
    textLimit: 280, formats: ["post", "thread", "poll"],
    capabilities: {
      publish: { supported: true, note: "يتطلب خطة X API تسمح بالكتابة." }, schedule: { supported: true },
      analytics: { supported: true, note: "public_metrics للتغريدات المنشورة من المنصة." },
      comments: { supported: false, note: "قراءة الردود تتطلب خطة X API مدفوعة؛ غير مفعّلة." },
      messages: { supported: false, note: "الرسائل الخاصة غير مفعّلة." },
    },
  },
  tiktok: {
    id: "tiktok", name: "TikTok", nameAr: "تيك توك", color: "#25F4EE", provider: "tiktok",
    textLimit: 2200, formats: ["video"],
    capabilities: {
      publish: { supported: true, note: "Content Posting API — التطبيقات غير المدققة تنشر بخصوصية SELF_ONLY حتى اجتياز التدقيق." },
      schedule: { supported: true }, analytics: { supported: true },
      comments: { supported: false, note: "لا يوفر TikTok API رسميًا لإدارة التعليقات للحسابات العادية." },
      messages: { supported: false },
    },
  },
  youtube: {
    id: "youtube", name: "YouTube", nameAr: "يوتيوب", color: "#FF0000", provider: "google",
    textLimit: 5000, formats: ["video", "short"],
    capabilities: {
      publish: { supported: true, note: "رفع عبر YouTube Data API v3 (حصة 1600 وحدة لكل رفع)." },
      schedule: { supported: true, note: "يدعم publishAt الأصلي من YouTube." },
      analytics: { supported: true }, comments: { supported: true }, messages: { supported: false },
    },
  },
  snapchat: {
    id: "snapchat", name: "Snapchat", nameAr: "سناب شات", color: "#FFFC00", provider: "snapchat",
    textLimit: 250, formats: ["story", "video"],
    capabilities: {
      publish: { supported: false, note: "لا تتوفر API رسمية لنشر Stories العضوية؛ يتم التجهيز والتصدير للنشر اليدوي." },
      schedule: { supported: false, note: "تذكير بالنشر اليدوي في الموعد." },
      analytics: { supported: true, note: "إحصاءات الحملات الإعلانية عبر Snapchat Marketing API." },
      comments: { supported: false }, messages: { supported: false },
    },
  },
  gmail: {
    id: "gmail", name: "Gmail", nameAr: "جيميل", color: "#EA4335", provider: "google",
    textLimit: 100000, formats: ["email"],
    capabilities: {
      publish: { supported: true, note: "إرسال عبر Gmail API (حد Google: ~500 مستلم يوميًا للحسابات الشخصية و2000 لـ Workspace)." },
      schedule: { supported: true },
      analytics: { supported: false, note: "Gmail API لا يوفر تتبع الفتح أو النقرات." },
      comments: { supported: false }, messages: { supported: false, note: "قراءة البريد تتطلب نطاقًا مقيدًا (restricted scope) وتقييمًا أمنيًا." },
    },
  },
};

export const SIZE_PRESETS = {
  instagram_post: { name: "Instagram Post", nameAr: "منشور إنستغرام", width: 1080, height: 1080, platforms: ["instagram"] },
  instagram_portrait: { name: "Instagram Portrait", nameAr: "إنستغرام عمودي", width: 1080, height: 1350, platforms: ["instagram"] },
  instagram_story: { name: "Instagram Story", nameAr: "ستوري إنستغرام", width: 1080, height: 1920, platforms: ["instagram"] },
  tiktok: { name: "TikTok", nameAr: "تيك توك", width: 1080, height: 1920, platforms: ["tiktok"] },
  snapchat: { name: "Snapchat", nameAr: "سناب شات", width: 1080, height: 1920, platforms: ["snapchat"] },
  youtube_thumbnail: { name: "YouTube Thumbnail", nameAr: "صورة مصغرة يوتيوب", width: 1280, height: 720, platforms: ["youtube"] },
  youtube_shorts: { name: "YouTube Shorts", nameAr: "يوتيوب شورتس", width: 1080, height: 1920, platforms: ["youtube"] },
  x_landscape: { name: "X Post (16:9)", nameAr: "منشور X أفقي", width: 1600, height: 900, platforms: ["x"] },
  x_square: { name: "X Post (1:1)", nameAr: "منشور X مربع", width: 1080, height: 1080, platforms: ["x"] },
  email_banner: { name: "Email Banner", nameAr: "بانر بريد", width: 1200, height: 600, platforms: ["gmail"] },
} as const;
export type SizePreset = keyof typeof SIZE_PRESETS;

/** X weighted length: URLs count 23; code points outside the "light" ranges count 2. */
export function xWeightedLength(text: string): number {
  const urlRe = /https?:\/\/\S+/g;
  let len = (text.match(urlRe)?.length ?? 0) * 23;
  const rest = text.replace(urlRe, "");
  for (const ch of rest) {
    const cp = ch.codePointAt(0)!;
    const light = (cp >= 0 && cp <= 4351) || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247);
    len += light ? 1 : 2;
  }
  return len;
}

export function textLength(platform: Platform, text: string) {
  return platform === "x" ? xWeightedLength(text) : [...text].length;
}

export const POST_STATUSES = [
  ["idea", "فكرة", "Idea"], ["draft", "مسودة", "Draft"], ["designing", "قيد التصميم", "Designing"],
  ["in_review", "قيد المراجعة", "In review"], ["approved", "جاهز للنشر", "Ready"], ["scheduled", "مجدول", "Scheduled"],
  ["publishing", "جاري النشر", "Publishing"], ["published", "منشور", "Published"], ["partially_published", "منشور جزئيًا", "Partially published"],
  ["failed", "فشل النشر", "Failed"], ["postponed", "مؤجل", "Postponed"], ["cancelled", "ملغي", "Cancelled"],
] as const;
