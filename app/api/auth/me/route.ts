import { route } from "@/lib/api";
import { requireCtx } from "@/lib/auth";
export const GET = route(async () => {
  const c = await requireCtx();
  return { user: { id: c.user.id, name: c.user.name, email: c.user.email, mfaEnabled: c.user.mfaEnabled, locale: c.user.locale }, workspace: { id: c.workspace.id, name: c.workspace.name, timezone: c.workspace.timezone }, role: c.role.key, permissions: [...c.perms], memberships: c.memberships };
});
