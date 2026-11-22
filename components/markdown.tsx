"use client";
// Minimal, XSS-safe markdown renderer (escapes HTML first).
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>").replace(/`([^`]+)`/g, "<code>$1</code>");

export function toHtml(md: string) {
  const lines = md.replace(/\r/g, "").split("\n"); const out: string[] = []; let list: "ul" | "ol" | null = null; let table: string[][] | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } if (table) { out.push("<table>" + table.map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join("")}</tr>`).join("") + "</table>"); table = null; } };
  for (const l of lines) {
    if (/^\s*\|.*\|\s*$/.test(l)) { if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue; const cells = l.trim().slice(1, -1).split("|").map((c) => c.trim()); if (!table) { close(); table = []; } table.push(cells); continue; }
    const h = l.match(/^(#{1,3})\s+(.*)/); const ul = l.match(/^\s*[-*•]\s+(.*)/); const ol = l.match(/^\s*\d+[.)]\s+(.*)/);
    if (h) { close(); out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); }
    else if (ul) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(ul[1])}</li>`); }
    else if (ol) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(ol[1])}</li>`); }
    else if (!l.trim()) close();
    else { close(); out.push(`<p>${inline(l)}</p>`); }
  }
  close(); return out.join("");
}
export function Markdown({ text }: { text: string }) { return <div className="prose-chat text-sm" dangerouslySetInnerHTML={{ __html: toHtml(text) }} />; }
