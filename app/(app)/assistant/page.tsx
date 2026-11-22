"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Send, Plus, Trash2, Sparkles, User, Copy, Settings } from "lucide-react";
import clsx from "clsx";
import { useApi } from "@/components/hooks";
import { useT } from "@/components/i18n";
import { Card, PageHeader, Button, useToast, Spinner } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { api } from "@/lib/client";

type Msg = { role: "user" | "assistant"; content: string };
const PROMPTS: [string, string][] = [
  ["اقترح محتوى لهذا الأسبوع", "Suggest content for this week"], ["أنشئ خطة تسويقية لشهر", "Create a one-month marketing plan"], ["ابتكر 10 أفكار فيديو قصيرة", "Brainstorm 10 short video ideas"],
  ["حلّل أداء حساباتي", "Analyze my accounts' performance"], ["لماذا انخفض التفاعل؟", "Why did engagement drop?"], ["اقترح أفضل وقت للنشر", "Suggest the best time to post"],
  ["أنشئ حملة إطلاق منتج", "Create a product launch campaign"], ["أنشئ خطة محتوى لمدة 90 يومًا", "Create a 90-day content plan"], ["اكتب 30 منشورًا لشهر كامل", "Write 30 posts for a month"],
];

export default function Assistant() {
  const t = useT(); const toast = useToast();
  const { data: threads, reload } = useApi<any[]>("/api/ai/threads"); const { data: status } = useApi<any>("/api/ai/status");
  const [threadId, setThreadId] = useState<string | null>(null); const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState(""); const [streaming, setStreaming] = useState(false);
  const end = useRef<HTMLDivElement>(null); const abort = useRef<AbortController | null>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  async function open(id: string) { setThreadId(id); try { const th = await api(`/api/ai/threads/${id}`); setMsgs(th.messages); } catch (e) { toast.error(e); } }
  async function send(text?: string) {
    const message = (text ?? input).trim(); if (!message || streaming) return;
    setInput(""); setMsgs((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]); setStreaming(true);
    abort.current = new AbortController();
    try {
      const r = await fetch("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ threadId, message }), signal: abort.current.signal });
      if (!r.ok || !r.body) { const j = await r.json().catch(() => null); throw new Error(j?.error?.message ?? `HTTP ${r.status}`); }
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
        for (const p of parts) {
          if (!p.startsWith("data: ")) continue; const ev = JSON.parse(p.slice(6));
          if (ev.t === "delta") setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: c[c.length - 1].content + ev.v }; return c; });
          if (ev.t === "done") { setThreadId(ev.threadId); reload(true); }
          if (ev.t === "error") throw new Error(ev.message);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") { toast.error(e); setMsgs((m) => (m[m.length - 1]?.content === "" ? m.slice(0, -1) : m)); }
    } finally { setStreaming(false); }
  }
  async function del(id: string) { await api(`/api/ai/threads/${id}`, { method: "DELETE" }); if (id === threadId) { setThreadId(null); setMsgs([]); } reload(true); }

  return <div>
    <PageHeader icon={<Bot />} title={t("المساعد التسويقي الذكي", "AI Marketing Assistant")} subtitle={t("يفهم علامتك التجارية وبيانات حساباتك الفعلية", "Understands your brand and your real account data")} />
    {status && !status.ready.llm && <Card className="mb-4 flex items-center gap-3 border-warning/40 bg-warning/5 p-4 text-sm"><Settings className="h-4 w-4 text-warning" /><span className="flex-1">{t("أضف مفتاح مزود النماذج اللغوية لتفعيل المساعد.", "Add an LLM provider key to enable the assistant.")}</span><Link href="/settings?tab=ai" className="btn-outline">{t("الإعدادات", "Settings")}</Link></Card>}
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card className="hidden h-[calc(100vh-220px)] flex-col p-3 lg:flex">
        <Button variant="outline" className="mb-3 w-full" onClick={() => { setThreadId(null); setMsgs([]); }}><Plus className="h-4 w-4" />{t("محادثة جديدة", "New chat")}</Button>
        <div className="flex-1 space-y-1 overflow-y-auto">{threads?.map((th) => <div key={th.id} className={clsx("group flex items-center gap-1 rounded-lg px-2 py-2 text-sm", th.id === threadId ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
          <button className="flex-1 truncate text-start" onClick={() => open(th.id)}>{th.title}</button><button className="opacity-0 group-hover:opacity-100" onClick={() => del(th.id)}><Trash2 className="h-3.5 w-3.5 text-subtle" /></button></div>)}</div>
      </Card>
      <Card className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {msgs.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-lg shadow-primary/30"><Sparkles className="h-7 w-7" /></div>
            <h2 className="text-lg font-semibold">{t("كيف أساعدك اليوم؟", "How can I help today?")}</h2>
            <div className="mt-6 grid max-w-2xl gap-2 sm:grid-cols-3">{PROMPTS.map(([a, e]) => <button key={a} onClick={() => send(t(a, e))} className="rounded-xl border border-border p-3 text-start text-sm transition hover:border-primary hover:bg-primary/5">{t(a, e)}</button>)}</div>
          </div> : msgs.map((m, i) => <div key={i} className={clsx("flex gap-3 animate-in", m.role === "user" && "flex-row-reverse")}>
            <div className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-full", m.role === "user" ? "bg-muted" : "bg-gradient-to-br from-primary to-fuchsia-500 text-white")}>{m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</div>
            <div className={clsx("group max-w-[85%] rounded-2xl px-4 py-2.5", m.role === "user" ? "bg-primary text-white" : "bg-muted/60")}>
              {m.role === "user" ? <p className="whitespace-pre-wrap text-sm leading-7">{m.content}</p> : m.content ? <Markdown text={m.content} /> : <Spinner />}
              {m.role === "assistant" && m.content && !streaming && <button className="mt-1 opacity-0 transition group-hover:opacity-100" onClick={() => { void navigator.clipboard.writeText(m.content); toast.success(t("تم النسخ", "Copied")); }}><Copy className="h-3.5 w-3.5 text-subtle" /></button>}
            </div>
          </div>)}
          <div ref={end} />
        </div>
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea className="input max-h-40 min-h-[48px] resize-none" rows={1} placeholder={t("اكتب طلبك... (Enter للإرسال، Shift+Enter لسطر جديد)", "Type your request… (Enter to send)")} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
            {streaming ? <Button variant="outline" onClick={() => abort.current?.abort()}>{t("إيقاف", "Stop")}</Button> : <Button onClick={() => send()} disabled={!input.trim()} className="h-12 w-12 p-0"><Send className="h-4 w-4 rtl:-scale-x-100" /></Button>}
          </div>
        </div>
      </Card>
    </div>
  </div>;
}
