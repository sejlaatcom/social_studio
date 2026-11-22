import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { analyticsSummary } from "@/lib/analytics";
import { analyticsInsights } from "@/lib/ai/service";
import { parseRange } from "@/lib/range";
import { badRequest } from "@/lib/errors";

export const maxDuration = 300;
export const POST = route(async (req) => {
  const c = await requireCtx("reports.view"); const sp = new URL(req.url).searchParams;
  const { from, to } = parseRange(sp);
  const data = await analyticsSummary(c.workspaceId, from, to, sp.get("platform") || undefined);
  if (!data.hasData) throw badRequest("لا توجد بيانات أداء فعلية لهذه الفترة بعد");
  return analyticsInsights({ workspaceId: c.workspaceId, userId: c.user.id }, { period: { from, to }, ...data, growth: data.growth.map((g) => ({ ...g, series: undefined })) });
});
