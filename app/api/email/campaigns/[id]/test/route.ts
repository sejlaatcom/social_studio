import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccessToken } from "@/lib/integrations";
import { buildMime, gmailSend, gmailDraft } from "@/lib/integrations/google";
import { badRequest, AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";

// Sends a single test email, or saves the message as a Gmail draft.
export const POST = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("campaigns.manage"); const { id } = await params;
  const b = await body(req, z.object({ to: z.string().email().optional(), draft: z.boolean().default(false) }));
  await rateLimit(`emailtest:${c.user.id}`, 10, 600);
  const e = await db.emailCampaign.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  if (!e.socialAccountId) throw badRequest("اختر حساب Gmail المرسل");
  try {
    const { token, account } = await getAccessToken(e.socialAccountId);
    const html = e.html.replace(/\{\{\s*name\s*\}\}/g, "").replace(/\{\{unsubscribe\}\}/g, "<span style='color:#9ca3af'>[رابط إلغاء الاشتراك]</span>");
    const raw = buildMime({ from: account.externalId, to: b.to ?? account.externalId, subject: (b.draft ? "" : "[تجربة] ") + e.subject, html });
    const r = b.draft ? await gmailDraft(token, raw) : await gmailSend(token, raw);
    return { ok: true, id: r.id };
  } catch (err) { throw new AppError(502, "gmail_error", (err as Error).message); }
});
