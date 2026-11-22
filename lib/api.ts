import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type infer as zInfer } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, badRequest } from "./errors";

type Handler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response | unknown>;

function json(data: unknown, status = 200) {
  return new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    status, headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function route<P = Record<string, string>>(fn: Handler<P>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof AppError) return json({ error: { code: e.code, message: e.message, details: e.details } }, e.status);
      if (e instanceof ZodError) return json({ error: { code: "validation", message: "بيانات غير صالحة", details: e.flatten() } }, 422);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        return json({ error: { code: "conflict", message: "القيمة مستخدمة مسبقًا" } }, 409);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")
        return json({ error: { code: "not_found", message: "العنصر غير موجود" } }, 404);
      console.error("[api]", e);
      return json({ error: { code: "internal", message: "حدث خطأ غير متوقع في الخادم" } }, 500);
    }
  };
}

export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<zInfer<S>> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw badRequest("صيغة JSON غير صالحة"); }
  return schema.parse(raw);
}
export { json };
