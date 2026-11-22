import { db } from "@/lib/db";
import { unsubscribeToken } from "@/lib/publishing";
import crypto from "node:crypto";

export default async function Unsubscribe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params; const { t } = await searchParams;
  const expected = unsubscribeToken(id);
  const ok = !!t && t.length === expected.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(expected));
  if (ok) await db.contact.updateMany({ where: { id }, data: { subscribed: false, unsubscribedAt: new Date() } });
  return <div className="grid min-h-screen place-items-center p-6"><div className="card max-w-md p-8 text-center">
    <h1 className="text-xl font-bold">{ok ? "تم إلغاء اشتراكك" : "رابط غير صالح"}</h1>
    <p className="mt-2 text-sm text-subtle">{ok ? "لن تصلك رسائل تسويقية أخرى من هذا المرسل. You have been unsubscribed." : "Invalid or expired link."}</p>
  </div></div>;
}
