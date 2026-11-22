"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

export function useApi<T = any>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(!!url);
  const seq = useRef(0);
  const load = useCallback(async (silent = false) => {
    if (!url) return;
    const n = ++seq.current;
    if (!silent) setLoading(true);
    try { const d = await api<T>(url); if (n === seq.current) { setData(d); setError(null); } }
    catch (e) { if (n === seq.current) setError(e); }
    finally { if (n === seq.current) setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

export function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}
