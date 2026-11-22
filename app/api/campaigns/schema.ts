import { z } from "zod";
export const CampaignSchema = z.object({
  name: z.string().trim().min(1).max(200), goal: z.string().max(3000).nullish(), audience: z.string().max(3000).nullish(),
  startDate: z.string().nullish(), endDate: z.string().nullish(), platforms: z.array(z.string()).default([]),
  budget: z.number().nonnegative().nullish(), currency: z.string().max(5).default("SAR"), products: z.string().max(5000).nullish(),
  keyMessages: z.string().max(5000).nullish(), cta: z.string().max(500).nullish(), visualIdentity: z.string().max(3000).nullish(),
  targetPostCount: z.number().int().min(1).max(200).nullish(), brandKitId: z.string().nullish(),
  status: z.enum(["planning", "active", "completed", "paused", "cancelled"]).optional(),
});
export const toDates = <T extends { startDate?: string | null; endDate?: string | null }>(b: T) => ({ ...b, startDate: b.startDate ? new Date(b.startDate) : null, endDate: b.endDate ? new Date(b.endDate) : null });
