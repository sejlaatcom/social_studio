"use client";
export class ApiError extends Error { constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); } }

export async function api<T = any>(url: string, opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const r = await fetch(url, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.form ? undefined : opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    signal: opts.signal, credentials: "same-origin",
  });
  const txt = await r.text();
  let data: any = null; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!r.ok) {
    if (r.status === 401 && typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(r.status, data?.error?.code ?? "error", data?.error?.message ?? `HTTP ${r.status}`, data?.error?.details);
  }
  return data as T;
}
