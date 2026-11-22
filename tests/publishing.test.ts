import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { IntegrationError } from "@/lib/integrations/types";

// Platform publishers are replaced with controllable fakes; everything else (DB, job state machine, logs, notifications) is real.
const behaviour: { mode: "ok" | "401" | "network" } = { mode: "ok" };
vi.mock("@/lib/integrations", async (orig) => {
  const real = await orig<typeof import("@/lib/integrations")>();
  const fake = { platform: "x", publish: vi.fn(async () => {
    if (behaviour.mode === "401") throw new IntegrationError("x", "x API (401): Unauthorized", { status: 401, needsReauth: true });
    if (behaviour.mode === "network") throw new IntegrationError("x", "network down", { retryable: true });
    return { externalId: "tweet-1", url: "https://x.com/t/status/tweet-1" };
  }) };
  return { ...real, PUBLISHERS: { ...real.PUBLISHERS, x: fake } };
});
const { schedulePost, executeJob, validatePost } = await import("@/lib/publishing");

let wsId = ""; let accId = ""; let orgId = "";
beforeAll(async () => {
  const org = await db.organization.create({ data: { name: "TestOrg", slug: `t-${Date.now()}` } }); orgId = org.id;
  const ws = await db.workspace.create({ data: { organizationId: org.id, name: "T", slug: "t" } }); wsId = ws.id;
  const conn = await db.oAuthConnection.create({ data: { workspaceId: ws.id, provider: "x", externalUserId: "u:x", accessTokenEnc: encrypt("tok"), scopes: [], expiresAt: new Date(Date.now() + 3600e3) } });
  accId = (await db.socialAccount.create({ data: { workspaceId: ws.id, connectionId: conn.id, platform: "x", externalId: "1", displayName: "acc", username: "acc" } })).id;
});
afterAll(async () => { await db.organization.delete({ where: { id: orgId } }); await db.$disconnect(); });

async function makePost(text: string) {
  return db.post.create({ data: { workspaceId: wsId, title: "t", body: text, variants: { create: [{ platform: "x", socialAccountId: accId, text }] } }, include: { variants: true } });
}
const runQueued = async (postId: string) => { const j = await db.publishingJob.findFirstOrThrow({ where: { variant: { postId } }, orderBy: { createdAt: "desc" } }); await executeJob(j.id); return j.id; };

describe("publishing state machine", () => {
  it("blocks invalid posts before queueing", async () => {
    const p = await makePost("ا".repeat(300));
    const checks = await validatePost(p.id, wsId);
    expect(checks.some((c) => c.code === "too_long" && c.level === "error")).toBe(true);
    const r = await schedulePost(p.id, wsId, new Date(Date.now() + 3600e3));
    expect(r.ok).toBe(false); expect(await db.publishingJob.count({ where: { variant: { postId: p.id } } })).toBe(0);
  });
  it("marks published only after the platform confirms", async () => {
    behaviour.mode = "ok"; const p = await makePost("hello");
    expect((await schedulePost(p.id, wsId, new Date(Date.now() + 3600e3))).ok).toBe(true);
    expect((await db.post.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("scheduled");
    await runQueued(p.id);
    const v = await db.postVariant.findFirstOrThrow({ where: { postId: p.id } });
    expect(v.status).toBe("published"); expect(v.externalId).toBe("tweet-1");
    expect((await db.post.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("published");
  });
  it("re-queues retryable errors with backoff", async () => {
    behaviour.mode = "network"; const p = await makePost("retry me");
    await schedulePost(p.id, wsId, new Date(Date.now() + 3600e3)); const jid = await runQueued(p.id);
    const j = await db.publishingJob.findUniqueOrThrow({ where: { id: jid } });
    expect(j.status).toBe("queued"); expect(j.attempts).toBe(1); expect(j.runAt.getTime()).toBeGreaterThan(Date.now() + 30e3);
    expect((await db.postVariant.findFirstOrThrow({ where: { postId: p.id } })).status).toBe("queued");
  });
  it("fails on 401, flags the account for re-auth and notifies", async () => {
    behaviour.mode = "401"; const p = await makePost("auth fail");
    await schedulePost(p.id, wsId, new Date(Date.now() + 3600e3)); await runQueued(p.id);
    expect((await db.postVariant.findFirstOrThrow({ where: { postId: p.id } })).status).toBe("failed");
    expect((await db.post.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("failed");
    expect((await db.socialAccount.findUniqueOrThrow({ where: { id: accId } })).status).toBe("needs_reauth");
    expect(await db.publishingLog.count({ where: { job: { variant: { postId: p.id } }, level: "error" } })).toBe(1);
  });
});
