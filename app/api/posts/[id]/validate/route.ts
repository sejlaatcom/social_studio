import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
import { validatePost } from "@/lib/publishing";
export const GET = route<{ id: string }>(async (_r, { params }) => { const c = await requireCtx(); return validatePost((await params).id, c.workspaceId); });
