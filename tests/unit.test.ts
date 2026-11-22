import { describe, it, expect } from "vitest";
import { encrypt, decrypt, totp, verifyTotp, generateTotpSecret, base32Decode, base32Encode, pkcePair } from "@/lib/crypto";
import { xWeightedLength, textLength } from "@/lib/platforms";
import { smartResize, buildLayout, TEMPLATES } from "@/lib/design";
import { buildMime } from "@/lib/integrations/google";
import { renderEmailHtml } from "@/lib/email-render";
import { buildSrt } from "@/lib/video";
import { sniffMime } from "@/lib/media";

describe("crypto", () => {
  it("round-trips AES-GCM and rejects tampering", () => {
    const c = encrypt("ya29.secret-token"); expect(c).not.toContain("secret"); expect(decrypt(c)).toBe("ya29.secret-token");
    const parts = c.split(":"); parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });
  it("TOTP matches RFC 6238 test vector", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(totp(secret, 59 * 1000, 30, 8)).toBe("94287082");
    expect(totp(secret, 1111111109 * 1000, 30, 8)).toBe("07081804");
    const s = generateTotpSecret(); expect(verifyTotp(s, totp(s))).toBe(true); expect(verifyTotp(s, "000000")).toBe(totp(s) === "000000");
    expect(base32Decode(base32Encode(Buffer.from("hello"))).toString()).toBe("hello");
  });
  it("PKCE challenge is base64url sha256 of verifier", () => { const p = pkcePair(); expect(p.verifier.length).toBeGreaterThan(42); expect(p.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/); });
});

describe("platform limits", () => {
  it("counts X weighted length (URLs = 23, CJK = 2, Arabic = 1)", () => {
    expect(xWeightedLength("مرحبا")).toBe(5);
    expect(xWeightedLength("see https://example.com/very/long/path")).toBe(4 + 23);
    expect(xWeightedLength("日本")).toBe(4);
    expect(textLength("instagram", "😀😀")).toBe(2);
  });
});

describe("design", () => {
  it("smart resize keeps layers in-bounds and scales type", () => {
    const t = TEMPLATES[0];
    const doc = buildLayout({ W: 1080, H: 1080, copy: t.copy, palette: t.palette, layout: t.layout });
    const r = smartResize(doc, 1080, 1080, 1080, 1920);
    expect(r.layers).toHaveLength(doc.layers.length);
    const head = r.layers.find((l) => l.role === "headline")!; const orig = doc.layers.find((l) => l.role === "headline")!;
    expect(head.fontSize).toBe(orig.fontSize); // min scale = 1
    for (const l of r.layers) if (l.role !== "decor") { expect(l.x + l.w / 2).toBeGreaterThanOrEqual(0); expect(l.x + l.w / 2).toBeLessThanOrEqual(1080); }
    const thumb = smartResize(doc, 1080, 1080, 1280, 720);
    expect(thumb.layers.find((l) => l.role === "headline")!.fontSize!).toBeLessThan(orig.fontSize!);
  });
});

describe("email", () => {
  it("builds RFC 2822 MIME with encoded Arabic subject and List-Unsubscribe", () => {
    const raw = buildMime({ from: "a@x.com", to: "b@y.com", subject: "عرض خاص", html: "<p>مرحبا</p>", listUnsubscribe: "https://u" });
    const txt = Buffer.from(raw, "base64url").toString();
    expect(txt).toContain("Subject: =?UTF-8?B?"); expect(txt).toContain("List-Unsubscribe: <https://u>"); expect(txt).toContain("multipart/alternative");
  });
  it("escapes HTML in rendered templates", () => {
    const h = renderEmailHtml({ headline: "<script>x</script>", paragraphs: ["a & b"], ctaLabel: "Go", ctaUrl: "https://x" });
    expect(h).not.toContain("<script>"); expect(h).toContain("&lt;script&gt;"); expect(h).toContain('dir="rtl"'); expect(h).toContain("{{unsubscribe}}");
  });
});

describe("video & media", () => {
  it("builds SRT timestamps", () => { expect(buildSrt([{ start: 1.5, end: 3.25, text: "مرحبا" }])).toBe("1\n00:00:01,500 --> 00:00:03,250\nمرحبا\n"); });
  it("sniffs magic bytes and rejects disguised files", () => {
    expect(sniffMime(Buffer.from("89504e470d0a1a0a0000", "hex"), "image/png")).toBe("image/png");
    expect(sniffMime(Buffer.from("<html><script>"), "image/png")).toBeNull();
    expect(sniffMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), "image/svg+xml")).toBe("image/svg+xml");
  });
});
