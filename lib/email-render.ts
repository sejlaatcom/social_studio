// Pure (isomorphic) email HTML renderer.
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export type EmailBlocks = { preheader?: string; headline: string; paragraphs: string[]; ctaLabel?: string; ctaUrl?: string; imageUrl?: string; footer?: string; color?: string; dir?: "rtl" | "ltr"; logoUrl?: string };

/** Email-client-safe table layout (inline styles), RTL aware. */
export function renderEmailHtml(b: EmailBlocks) {
  const dir = b.dir ?? "rtl"; const align = dir === "rtl" ? "right" : "left"; const color = b.color ?? "#6d5dfc";
  return `<!doctype html><html dir="${dir}" lang="${dir === "rtl" ? "ar" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(b.headline)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Tahoma,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(b.preheader ?? "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
${b.logoUrl ? `<tr><td style="padding:24px 32px 0;text-align:${align}"><img src="${esc(b.logoUrl)}" alt="" height="40" style="height:40px"></td></tr>` : ""}
${b.imageUrl ? `<tr><td><img src="${esc(b.imageUrl)}" alt="" width="600" style="width:100%;display:block"></td></tr>` : ""}
<tr><td style="padding:32px;text-align:${align};direction:${dir}">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.4;color:#111827">${esc(b.headline)}</h1>
${b.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.8;color:#374151">${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}
${b.ctaLabel && b.ctaUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background:${color};border-radius:8px"><a href="${esc(b.ctaUrl)}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px">${esc(b.ctaLabel)}</a></td></tr></table>` : ""}
</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:12px;color:#9ca3af;text-align:${align};direction:${dir}">${esc(b.footer ?? "")}<br>{{unsubscribe}}</td></tr>
</table></td></tr></table></body></html>`;
}

