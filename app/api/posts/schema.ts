import { z } from "zod";

export const VariantSchema = z.object({
  id: z.string().optional(),
  platform: z.enum(["instagram", "x", "tiktok", "youtube", "snapchat", "gmail"]),
  socialAccountId: z.string().nullish(),
  format: z.enum(["post", "carousel", "reel", "story", "thread", "poll", "video", "short", "email"]).default("post"),
  text: z.string().max(100000).default(""), title: z.string().max(1000).nullish(),
  hashtags: z.array(z.string().max(120)).max(60).default([]), threadParts: z.array(z.string().max(2000)).max(25).default([]),
  pollOptions: z.array(z.string().max(60)).max(4).default([]), options: z.record(z.unknown()).nullish(),
  media: z.array(z.object({ assetId: z.string(), altText: z.string().max(1000).nullish() })).max(20).optional(),
});
export const PostSchema = z.object({
  title: z.string().trim().min(1).max(300), body: z.string().max(100000).default(""),
  status: z.enum(["idea", "draft", "designing", "in_review", "approved", "postponed", "cancelled"]).optional(),
  contentType: z.string().max(40).nullish(), projectId: z.string().nullish(), ideaId: z.string().nullish(), campaignId: z.string().nullish(),
  scheduledAt: z.string().datetime().nullish(),
  media: z.array(z.object({ assetId: z.string(), altText: z.string().max(1000).nullish() })).max(20).default([]),
  variants: z.array(VariantSchema).max(12).default([]),
});
