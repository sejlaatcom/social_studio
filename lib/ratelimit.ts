import { redis } from "./redis";
import { AppError } from "./errors";

/** Fixed-window limiter backed by Redis. */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const k = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const n = await redis().incr(k);
  if (n === 1) await redis().expire(k, windowSec);
  if (n > limit) throw new AppError(429, "rate_limited", "عدد كبير من الطلبات، حاول بعد قليل");
}
