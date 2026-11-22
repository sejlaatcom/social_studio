import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { SIZE_PRESETS } from "@/lib/platforms";
import { smartResize, type DesignDoc } from "@/lib/design";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const c = await requireCtx("content.create"); const { id } = await params;
  const b = await body(req, z.object({ presets: z.array(z.string()).min(1).max(10) }));
  const d = await db.designProject.findFirstOrThrow({ where: { id, workspaceId: c.workspaceId } });
  const out = [];
  for (const key of b.presets) {
    const p = SIZE_PRESETS[key as keyof typeof SIZE_PRESETS]; if (!p) continue;
    const doc = smartResize(d.document as DesignDoc, d.width, d.height, p.width, p.height);
    out.push(await db.designProject.create({ data: { workspaceId: c.workspaceId, name: `${d.name} — ${p.name}`, preset: key, width: p.width, height: p.height, document: doc } }));
  }
  return out;
});
