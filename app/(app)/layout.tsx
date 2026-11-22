import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getSetting, DEFAULT_BRANDING, type BrandingSettings } from "@/lib/settings";
import { Shell } from "@/components/shell";

function hexToRgb(hex: string) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : "109 93 252";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try { ctx = await requireCtx(); } catch (e) { if (e instanceof AppError && e.status === 401) redirect("/login"); throw e; }
  const branding = { ...DEFAULT_BRANDING, ...((await getSetting<BrandingSettings>(ctx.workspaceId, "branding")) ?? {}) };
  return (
    <>
      <style>{`:root{--primary:${hexToRgb(branding.primaryColor)}}`}</style>
      <Shell user={{ name: ctx.user.name, email: ctx.user.email }} workspace={{ id: ctx.workspaceId, name: ctx.workspace.name }} memberships={ctx.memberships} perms={[...ctx.perms]} branding={branding}>
        {children}
      </Shell>
    </>
  );
}
