import { z } from "zod";
export const CampaignBody = z.object({ name: z.string().min(1).max(200), subject: z.string().min(1).max(300), html: z.string().min(1).max(500000), socialAccountId: z.string().nullish(), groupId: z.string().nullish(), templateId: z.string().nullish() });
