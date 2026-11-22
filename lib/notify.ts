import { db } from "./db";

/** Creates in-app notifications. When userId omitted, notifies every member of the workspace. */
export async function notify(workspaceId: string, n: { type: string; title: string; body?: string; link?: string; userId?: string }) {
  if (n.userId) {
    await db.notification.create({ data: { workspaceId, userId: n.userId, type: n.type, title: n.title, body: n.body, link: n.link } });
    return;
  }
  const members = await db.membership.findMany({ where: { workspaceId }, select: { userId: true } });
  await db.notification.createMany({ data: members.map((m) => ({ workspaceId, userId: m.userId, type: n.type, title: n.title, body: n.body, link: n.link })) });
}
