import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { confirmManual } from "@/lib/publishing";
import { audit } from "@/lib/audit";

// Confirms a manual publication (platforms without a publishing API) with the live URL.
export const POST = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("content.publish"); const { id } = await params;
  const b = await body(req, z.object({ variantId: z.string(), url: z.string().url().optional().or(z.literal("")) }));
  await confirmManual(b.variantId, c.workspaceId, b.url || undefined);
  await audit({ workspaceId: c.workspaceId, userId: c.user.id, action: "post.manual_confirm", entityType: "Post", entityId: id, meta: { variantId: b.variantId, url: b.url } });
  return { ok: true };
});
