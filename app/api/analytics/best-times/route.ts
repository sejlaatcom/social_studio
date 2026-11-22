import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { bestTimes } from "@/lib/analytics";
export const GET = route(async (req) => { const c = await requireCtx(); return bestTimes(c.workspaceId, new URL(req.url).searchParams.get("platform") || undefined); });
