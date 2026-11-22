import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { analyticsSummary } from "@/lib/analytics";
import { parseRange } from "@/lib/range";

export const GET = route(async (req) => {
  const c = await requireCtx("reports.view"); const sp = new URL(req.url).searchParams;
  const { from, to } = parseRange(sp);
  return analyticsSummary(c.workspaceId, from, to, sp.get("platform") || undefined);
});
