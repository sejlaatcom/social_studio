import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { queue, QUEUES } from "@/lib/queue";
import { badRequest } from "@/lib/errors";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("content.publish"); const { id } = await params;
  const b = await body(req, z.object({ mode: z.enum(["now", "schedule", "cancel"]), at: z.string().datetime().optional() }));
  const e = await db.emailCampaign.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  if (b.mode === "cancel") { await db.emailCampaign.update({ where: { id }, data: { status: "draft", scheduledAt: null } }); return { ok: true }; }
  if (!e.socialAccountId || !e.groupId) throw badRequest("حدد حساب Gmail المرسل ومجموعة المستلمين");
  const acc = await db.socialAccount.findFirst({ where: { id: e.socialAccountId, workspaceId: c.workspaceId, platform: "gmail" } });
  if (!acc || acc.status !== "connected") throw badRequest("حساب Gmail غير متصل");
  const n = await db.contact.count({ where: { workspaceId: c.workspaceId, subscribed: true, groups: { some: { groupId: e.groupId } } } });
  if (!n) throw badRequest("لا يوجد مستلمون مشتركون في المجموعة");
  if (!e.html.includes("{{unsubscribe}}")) throw badRequest("يجب أن تحتوي الرسالة على رابط إلغاء الاشتراك {{unsubscribe}}");
  const at = b.mode === "now" ? new Date() : new Date(b.at ?? "");
  if (isNaN(at.getTime())) throw badRequest("موعد غير صالح");
  await db.emailCampaign.update({ where: { id }, data: { status: "scheduled", scheduledAt: at, lastError: null } });
  if (b.mode === "now") await queue(QUEUES.email).add("send", { campaignId: id }, { jobId: `email-${id}-${Date.now()}` });
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: b.mode === "now" ? "email.send" : "email.schedule", entityType: "EmailCampaign", entityId: id, meta: { recipients: n } });
  return { ok: true, recipients: n };
});
