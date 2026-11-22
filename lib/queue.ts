import { Queue } from "bullmq";
import { redis } from "./redis";

export const QUEUES = { publish: "publish", video: "video", analytics: "analytics", email: "email", maintenance: "maintenance" } as const;

const g = globalThis as unknown as { queues?: Record<string, Queue> };
export function queue(name: (typeof QUEUES)[keyof typeof QUEUES]) {
  g.queues ??= {};
  g.queues[name] ??= new Queue(name, { connection: redis(), defaultJobOptions: { removeOnComplete: 500, removeOnFail: 1000 } });
  return g.queues[name];
}
