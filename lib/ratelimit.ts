import { redis } from "./redis";
import { AppError } from "./errors";

/** Fixed-window limiter backed by Redis. If Redis is unreachable it degrades open after 1.5s instead of hanging the request. */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const k = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  let n: number;
  try {
    n = await Promise.race([
      (async () => { const v = await redis().incr(k); if (v === 1) await redis().expire(k, windowSec); return v; })(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("redis timeout")), 1500)),
    ]);
  } catch (e) { console.warn("[ratelimit] skipped:", (e as Error).message); return; }
  if (n > limit) throw new AppError(429, "rate_limited", "عدد كبير من الطلبات، حاول بعد قليل");
}
