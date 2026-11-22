import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { conflict } from "@/lib/errors";
import { CampaignBody } from "../schema";
export const GET = route<{ id: string }>(async (_r, { params }) => { const c = await requireCtx(); return db.emailCampaign.findFirstOrThrow({ where: { id: (await params).id, workspaceId: c.workspaceId } }); });
export const PUT = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("campaigns.manage"); const { id } = await params; const b = await body(req, CampaignBody);
  const e = await db.emailCampaign.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  if (["sending", "sent"].includes(e.status)) throw conflict("لا يمكن تعديل حملة تم إرسالها");
  return db.emailCampaign.update({ where: { id }, data: b });
});
export const DELETE = route<{ id: string }>(async (_r, { params }) => {
  const c = await requireCtx("campaigns.manage"); const { id } = await params;
  const e = await db.emailCampaign.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  if (e.status === "sending") throw conflict("الحملة قيد الإرسال"); await db.emailCampaign.delete({ where: { id } }); return { ok: true };
});
