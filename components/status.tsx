"use client";
import { Badge } from "./ui";
import { useT } from "./i18n";

const MAP: Record<string, [string, string, "default" | "primary" | "success" | "warning" | "danger"]> = {
  idea: ["فكرة", "Idea", "default"], draft: ["مسودة", "Draft", "default"], designing: ["قيد التصميم", "Designing", "primary"],
  in_review: ["قيد المراجعة", "In review", "warning"], approved: ["جاهز للنشر", "Ready", "primary"], scheduled: ["مجدول", "Scheduled", "primary"],
  publishing: ["جاري النشر", "Publishing", "warning"], published: ["منشور", "Published", "success"], partially_published: ["منشور جزئيًا", "Partial", "warning"],
  failed: ["فشل النشر", "Failed", "danger"], postponed: ["مؤجل", "Postponed", "default"], cancelled: ["ملغي", "Cancelled", "default"],
  pending: ["بانتظار", "Pending", "default"], queued: ["في الطابور", "Queued", "primary"], manual_required: ["نشر يدوي", "Manual", "warning"], skipped: ["متجاوز", "Skipped", "default"],
  connected: ["متصل", "Connected", "success"], needs_reauth: ["يحتاج إعادة ربط", "Needs re-auth", "warning"], error: ["خطأ", "Error", "danger"], disconnected: ["مفصول", "Disconnected", "default"],
  planning: ["تخطيط", "Planning", "default"], active: ["نشطة", "Active", "success"], completed: ["مكتملة", "Completed", "primary"], paused: ["متوقفة", "Paused", "warning"],
  rendering: ["جاري الإخراج", "Rendering", "warning"], rendered: ["جاهز", "Rendered", "success"], ready: ["جاهز", "Ready", "primary"], scripting: ["كتابة السيناريو", "Scripting", "primary"],
  sending: ["جاري الإرسال", "Sending", "warning"], sent: ["أُرسلت", "Sent", "success"], partially_sent: ["أُرسلت جزئيًا", "Partially sent", "warning"],
  open: ["مفتوح", "Open", "primary"], replied: ["تم الرد", "Replied", "success"], needs_follow_up: ["يحتاج متابعة", "Follow-up", "warning"], closed: ["مغلق", "Closed", "default"],
  new: ["جديدة", "New", "primary"], in_progress: ["قيد العمل", "In progress", "warning"], used: ["مستخدمة", "Used", "success"], archived: ["مؤرشفة", "Archived", "default"],
};
export function StatusBadge({ status }: { status: string }) {
  const t = useT(); const m = MAP[status] ?? [status, status, "default"];
  return <Badge tone={m[2]}>{t(m[0], m[1])}</Badge>;
}
export const STATUS_LABELS = MAP;
