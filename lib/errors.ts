export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export const badRequest = (m: string, d?: unknown) => new AppError(400, "bad_request", m, d);
export const unauthorized = (m = "يجب تسجيل الدخول") => new AppError(401, "unauthorized", m);
export const forbidden = (m = "ليست لديك صلاحية لتنفيذ هذا الإجراء") => new AppError(403, "forbidden", m);
export const notFound = (m = "العنصر غير موجود") => new AppError(404, "not_found", m);
export const conflict = (m: string) => new AppError(409, "conflict", m);
export const notConfigured = (m: string) => new AppError(424, "not_configured", m);
export const limitReached = (m: string) => new AppError(402, "plan_limit", m);
