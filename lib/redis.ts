import IORedis from "ioredis";

const g = globalThis as unknown as { redis?: IORedis };
export function redis(): IORedis {
  if (!g.redis) g.redis = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", { maxRetriesPerRequest: null });
  return g.redis;
}
