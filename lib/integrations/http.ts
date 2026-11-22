import { IntegrationError } from "./types";

/** fetch with retry/backoff on 429/5xx and normalized errors. */
export async function req<T = unknown>(provider: string, url: string, init: RequestInit & { retries?: number; raw?: boolean } = {}): Promise<T> {
  const retries = init.retries ?? 3;
  let lastErr: IntegrationError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let r: Response;
    try {
      r = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
    } catch (e) {
      lastErr = new IntegrationError(provider, `تعذر الاتصال بخادم ${provider}: ${(e as Error).message}`, { retryable: true });
      await sleep(backoff(attempt)); continue;
    }
    if (r.ok) {
      if (init.raw) return r as unknown as T;
      const txt = await r.text();
      if (!txt) return {} as T;
      try { return JSON.parse(txt) as T; } catch { return txt as unknown as T; }
    }
    const text = await r.text();
    let body: unknown = text; try { body = JSON.parse(text); } catch { /* text */ }
    const msg = extractMessage(body) ?? text.slice(0, 300);
    const retryable = r.status === 429 || r.status >= 500;
    lastErr = new IntegrationError(provider, `${provider} API (${r.status}): ${msg}`, { status: r.status, retryable, needsReauth: r.status === 401, body });
    if (!retryable || attempt === retries) break;
    const ra = Number(r.headers.get("retry-after"));
    await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 60_000) : backoff(attempt));
  }
  throw lastErr!;
}
const backoff = (n: number) => Math.min(30_000, 1000 * 2 ** n + Math.random() * 500);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractMessage(b: unknown): string | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, any>;
  return o.error?.message ?? o.error_description ?? o.detail ?? o.title ?? o.message ?? o.error?.error_msg ?? (typeof o.error === "string" ? o.error : null) ?? o.errors?.[0]?.message ?? null;
}

export const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
export const basic = (id: string, secret: string) => "Basic " + Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`).toString("base64");
