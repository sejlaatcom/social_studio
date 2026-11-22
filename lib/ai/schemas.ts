// JSON Schemas for structured outputs (strict: every object closes additionalProperties and requires all keys).
type S = Record<string, unknown>;
const str: S = { type: "string" };
const strArr: S = { type: "array", items: { type: "string" } };
const num: S = { type: "number" };
export const obj = (props: Record<string, S>): S => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });
const arr = (items: S): S => ({ type: "array", items });

export const contentPackSchema = obj({
  headline: str, body: str, shortVersion: str, longVersion: str, cta: str, hashtags: strArr,
  imageIdeas: strArr, videoIdeas: strArr,
  instagram: obj({ caption: str, hashtags: strArr, altText: str }),
  reel: obj({ hook: str, script: str, caption: str }),
  story: obj({ frames: strArr }),
  x: obj({ post: str, thread: strArr }),
  tiktok: obj({ hook: str, script: str, caption: str, hashtags: strArr }),
  youtube: obj({ title: str, description: str, tags: strArr, shortsScript: str, thumbnailText: str }),
  snapchat: obj({ storyText: str, frames: strArr }),
  email: obj({ subject: str, preheader: str, headline: str, body: str, ctaLabel: str }),
});

export const rewriteSchema = obj({ variants: arr(obj({ label: str, text: str })) });

export const campaignPlanSchema = obj({
  summary: str, strategy: str,
  weeks: arr(obj({
    week: num, theme: str,
    posts: arr(obj({ dayOffset: num, time: str, platform: str, format: str, contentType: str, title: str, text: str, hashtags: strArr, visualIdea: str })),
  })),
});

export const insightsSchema = obj({ summary: str, insights: strArr, recommendations: strArr });

export const designSchema = obj({
  headline: str, subheadline: str, cta: str, badge: str, backgroundPrompt: str,
  palette: obj({ background: str, backgroundAlt: str, primary: str, text: str, accent: str }),
  layout: { type: "string", enum: ["centered", "split", "bold", "minimal"] },
});

export const videoScriptSchema = obj({
  title: str, hook: str, intro: str, outro: str, caption: str, hashtags: strArr,
  scenes: arr(obj({ narration: str, onScreenText: str, visualPrompt: str, durationSec: num })),
});

export const replySchema = obj({ category: { type: "string", enum: ["question", "complaint", "praise", "spam", "lead", "other"] }, priority: { type: "string", enum: ["high", "normal", "low"] }, needsFollowUp: { type: "boolean" }, replies: strArr });

export const clipsSchema = obj({ clips: arr(obj({ start: num, end: num, title: str, hook: str })) });

export const ideasSchema = obj({ ideas: arr(obj({ title: str, body: str, platforms: strArr, contentType: str })) });

export const emailSchema = obj({ subject: str, preheader: str, headline: str, paragraphs: strArr, ctaLabel: str, footer: str });
