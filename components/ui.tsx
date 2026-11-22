"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { CircleCheck, CircleX, Info, Loader2, X } from "lucide-react";
import { useT } from "./i18n";

export { clsx };

export function Spinner({ className }: { className?: string }) { return <Loader2 className={clsx("animate-spin", className ?? "h-4 w-4")} />; }

export function Button({ loading, variant = "primary", className, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: "primary" | "ghost" | "outline" | "danger" }) {
  return <button {...p} disabled={p.disabled || loading} className={clsx(`btn-${variant}`, className)}>{loading && <Spinner />}{children}</button>;
}

export function Field({ label, hint, error, children, className }: { label?: React.ReactNode; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string }) {
  return <div className={className}>{label && <label className="label">{label}</label>}{children}{error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}</div>;
}

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) { return <div {...p} className={clsx("card", className)}>{children}</div>; }

export function PageHeader({ title, subtitle, actions, icon }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-in">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</div>}
        <div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-subtle">{subtitle}</p>}</div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) { return <div className={clsx("skeleton", className)} />; }
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-3">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center animate-in">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm text-subtle">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({ tone = "default", children, className }: { tone?: "default" | "primary" | "success" | "warning" | "danger"; children: React.ReactNode; className?: string }) {
  const t = { default: "bg-muted text-subtle", primary: "bg-primary/10 text-primary", success: "bg-success/10 text-success", warning: "bg-warning/15 text-warning", danger: "bg-danger/10 text-danger" }[tone];
  return <span className={clsx("chip", t, className)}>{children}</span>;
}

export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  const w = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={clsx("card flex max-h-[92vh] w-full flex-col rounded-b-none animate-in sm:rounded-2xl", w)} role="dialog" aria-modal>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0" aria-label="close"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>, document.body);
}

export function Confirm({ open, onClose, onConfirm, title, body, danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body?: React.ReactNode; danger?: boolean; loading?: boolean }) {
  const t = useT();
  return <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><Button variant="ghost" onClick={onClose}>{t("إلغاء", "Cancel")}</Button><Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{t("تأكيد", "Confirm")}</Button></>}>
    <div className="text-sm text-subtle">{body}</div>
  </Modal>;
}

type Toast = { id: number; tone: "success" | "error" | "info"; text: string };
const ToastCtx = createContext<(tone: Toast["tone"], text: string) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, set] = useState<Toast[]>([]);
  const n = useRef(0);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = ++n.current; set((x) => [...x, { id, tone, text }]);
    setTimeout(() => set((x) => x.filter((t) => t.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);
  return <ToastCtx.Provider value={push}>{children}
    <div className="pointer-events-none fixed bottom-4 start-4 end-4 z-[60] flex flex-col items-center gap-2 sm:start-auto sm:items-end">
      {items.map((t) => (
        <div key={t.id} className="card pointer-events-auto flex max-w-sm items-start gap-2.5 px-4 py-3 text-sm shadow-pop animate-in">
          {t.tone === "success" ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : t.tone === "error" ? <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
          <span className="leading-6">{t.text}</span>
        </div>
      ))}
    </div>
  </ToastCtx.Provider>;
}
export function useToast() {
  const push = useContext(ToastCtx);
  return { success: (t: string) => push("success", t), error: (e: unknown) => push("error", e instanceof Error ? e.message : String(e)), info: (t: string) => push("info", t) };
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode }[]; className?: string }) {
  return <div className={clsx("inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1", className)}>
    {items.map((i) => <button key={i.value} onClick={() => onChange(i.value)} className={clsx("rounded-lg px-3 py-1.5 text-sm transition", value === i.value ? "bg-surface font-medium shadow-sm" : "text-subtle hover:text-fg")}>{i.label}</button>)}
  </div>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode }) {
  return <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={clsx("relative h-5 w-9 rounded-full transition", checked ? "bg-primary" : "bg-border")}>
      <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "start-[18px]" : "start-0.5")} />
    </button>{label}
  </label>;
}

export function StatCard({ label, value, icon, hint, tone = "primary" }: { label: string; value: React.ReactNode; icon: React.ReactNode; hint?: React.ReactNode; tone?: "primary" | "success" | "warning" | "danger" }) {
  const c = { primary: "text-primary bg-primary/10", success: "text-success bg-success/10", warning: "text-warning bg-warning/15", danger: "text-danger bg-danger/10" }[tone];
  return <Card className="p-4 transition hover:-translate-y-0.5 hover:shadow-pop">
    <div className="flex items-center justify-between"><span className="text-xs text-subtle">{label}</span><span className={clsx("grid h-8 w-8 place-items-center rounded-lg", c)}>{icon}</span></div>
    <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
    {hint && <div className="mt-1 text-xs text-subtle">{hint}</div>}
  </Card>;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT();
  return <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm">
    <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
    <div className="flex-1"><p className="text-danger">{error instanceof Error ? error.message : String(error)}</p>{onRetry && <button className="mt-2 text-xs underline" onClick={onRetry}>{t("إعادة المحاولة", "Retry")}</button>}</div>
  </div>;
}

export function TagInput({ value, onChange, placeholder, prefix }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; prefix?: string }) {
  const [txt, setTxt] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean).map((s) => (prefix && !s.startsWith(prefix) ? prefix + s.replace(/\s+/g, "_") : s));
    if (parts.length) onChange([...new Set([...value, ...parts])]); setTxt("");
  };
  return <div className="input flex min-h-[42px] flex-wrap items-center gap-1.5 py-1.5">
    {value.map((v) => <span key={v} className="chip bg-primary/10 text-primary">{v}<button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label="remove"><X className="h-3 w-3" /></button></span>)}
    <input className="min-w-[100px] flex-1 bg-transparent text-sm outline-none" value={txt} placeholder={placeholder} onChange={(e) => setTxt(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(txt); } else if (e.key === "Backspace" && !txt && value.length) onChange(value.slice(0, -1)); }} onBlur={() => txt && add(txt)} />
  </div>;
}
