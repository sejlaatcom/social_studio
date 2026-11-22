import { z } from "zod";

export const BrandSchema = z.object({
  name: z.string().trim().min(1).max(100), isDefault: z.boolean().optional(), description: z.string().max(3000).nullish(), logoAssetId: z.string().nullish(),
  colors: z.array(z.object({ name: z.string().max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).max(12).optional(),
  fonts: z.array(z.object({ role: z.string().max(30), family: z.string().max(60) })).max(6).optional(),
  toneOfVoice: z.string().max(2000).nullish(), audience: z.string().max(2000).nullish(), products: z.string().max(5000).nullish(), services: z.string().max(5000).nullish(),
  values: z.string().max(2000).nullish(), language: z.enum(["ar", "en"]).optional(), dialect: z.string().max(30).nullish(),
  hashtags: z.array(z.string().max(60)).max(30).optional(), forbiddenWords: z.array(z.string().max(60)).max(50).optional(), website: z.string().max(300).nullish(),
});
