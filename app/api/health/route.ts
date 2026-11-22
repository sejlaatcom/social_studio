import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
export async function GET() {
  const out: Record<string, string> = {};
  try { await db.$queryRaw`SELECT 1`; out.db = "ok"; } catch (e) { out.db = (e as Error).message; }
  try { out.redis = (await redis().ping()) === "PONG" ? "ok" : "fail"; } catch (e) { out.redis = (e as Error).message; }
  return Response.json(out, { status: Object.values(out).every((v) => v === "ok") ? 200 : 503 });
}
