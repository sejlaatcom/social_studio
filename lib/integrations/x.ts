import fs from "node:fs";
import { req, form, basic, sleep } from "./http";
import { IntegrationError, type IntegrationProvider, type PlatformPublisher, type Metrics } from "./types";

const API = "https://api.x.com/2";
const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"];

export const xProvider: IntegrationProvider = {
  id: "x", name: "X (Twitter)", platforms: ["x"], envPrefix: "X", docsUrl: "https://developer.x.com/en/portal/dashboard", usesPkce: true,
  scopesFor: () => SCOPES,
  authUrl({ app, redirectUri, state, codeChallenge }) {
    return `https://x.com/i/oauth2/authorize?${form({ response_type: "code", client_id: app.clientId, redirect_uri: redirectUri, scope: SCOPES.join(" "), state, code_challenge: codeChallenge!, code_challenge_method: "S256" })}`;
  },
  async exchangeCode({ app, code, redirectUri, codeVerifier }) {
    const t = await req<any>("x", `${API}/oauth2/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", Authorization: basic(app.clientId, app.clientSecret) },
      body: form({ code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: codeVerifier ?? "", client_id: app.clientId }), retries: 0 });
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresIn: t.expires_in, scopes: String(t.scope ?? "").split(" "), tokenType: t.token_type };
  },
  async refresh({ app, refreshToken }) {
    if (!refreshToken) throw new IntegrationError("x", "لا يوجد refresh token؛ أعد الربط", { needsReauth: true });
    const t = await req<any>("x", `${API}/oauth2/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", Authorization: basic(app.clientId, app.clientSecret) },
      body: form({ refresh_token: refreshToken, grant_type: "refresh_token", client_id: app.clientId }), retries: 1 });
    return { accessToken: t.access_token, refreshToken: t.refresh_token ?? refreshToken, expiresIn: t.expires_in, scopes: String(t.scope ?? "").split(" ") };
  },
  async revoke({ app, token }) {
    await req("x", `${API}/oauth2/revoke`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", Authorization: basic(app.clientId, app.clientSecret) }, body: form({ token, token_type_hint: "access_token" }), retries: 0 }).catch(() => undefined);
  },
  async discoverAccounts({ accessToken }) {
    const me = await req<any>("x", `${API}/users/me?user.fields=profile_image_url,public_metrics,username,name`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const u = me.data;
    return [{ platform: "x", externalId: u.id, username: u.username, displayName: u.name, avatarUrl: u.profile_image_url, followers: u.public_metrics?.followers_count ?? null }];
  },
};

async function uploadMedia(token: string, m: { localPath: string; mimeType: string; sizeBytes: number }) {
  const auth = { Authorization: `Bearer ${token}` };
  const category = m.mimeType.startsWith("video/") ? "tweet_video" : m.mimeType === "image/gif" ? "tweet_gif" : "tweet_image";
  const init = await req<any>("x", `${API}/media/upload/initialize`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ media_type: m.mimeType, total_bytes: m.sizeBytes, media_category: category }) });
  const id = init.data?.id ?? init.media_id_string;
  const buf = fs.readFileSync(m.localPath);
  const CHUNK = 4 * 1024 * 1024;
  for (let i = 0, seg = 0; i < buf.length; i += CHUNK, seg++) {
    const fd = new FormData();
    fd.append("media", new Blob([new Uint8Array(buf.subarray(i, i + CHUNK))]));
    fd.append("segment_index", String(seg));
    await req("x", `${API}/media/upload/${id}/append`, { method: "POST", headers: auth, body: fd });
  }
  let fin = await req<any>("x", `${API}/media/upload/${id}/finalize`, { method: "POST", headers: auth });
  let info = fin.data?.processing_info;
  while (info && (info.state === "pending" || info.state === "in_progress")) {
    await sleep((info.check_after_secs ?? 3) * 1000);
    fin = await req<any>("x", `${API}/media/upload?command=STATUS&media_id=${id}`, { headers: auth });
    info = fin.data?.processing_info;
  }
  if (info?.state === "failed") throw new IntegrationError("x", `فشلت معالجة الوسائط لدى X: ${info.error?.message ?? ""}`);
  return String(id);
}

export const xPublisher: PlatformPublisher = {
  platform: "x",
  async publish(i) {
    const auth = { Authorization: `Bearer ${i.accessToken}`, "content-type": "application/json" };
    const mediaIds: string[] = [];
    for (const m of i.media.slice(0, 4)) mediaIds.push(await uploadMedia(i.accessToken, m));
    const parts = i.format === "thread" && i.threadParts.length ? i.threadParts : [[i.text, i.hashtags.join(" ")].filter(Boolean).join("\n\n")];
    let prev: string | null = null; let first: string | null = null;
    for (let idx = 0; idx < parts.length; idx++) {
      const payload: Record<string, unknown> = { text: parts[idx] };
      if (idx === 0 && mediaIds.length) payload.media = { media_ids: mediaIds };
      if (idx === 0 && i.format === "poll" && i.pollOptions.length >= 2) { payload.poll = { options: i.pollOptions.slice(0, 4), duration_minutes: Number(i.options.pollDurationMinutes ?? 1440) }; delete payload.media; }
      if (prev) payload.reply = { in_reply_to_tweet_id: prev };
      const r = await req<any>("x", `${API}/tweets`, { method: "POST", headers: auth, body: JSON.stringify(payload), retries: 1 });
      prev = r.data.id; first ??= r.data.id;
    }
    return { externalId: first!, url: `https://x.com/${i.account.username ?? "i"}/status/${first}` };
  },
  async accountMetrics({ accessToken }) {
    const me = await req<any>("x", `${API}/users/me?user.fields=public_metrics`, { headers: { Authorization: `Bearer ${accessToken}` } });
    return { followers: me.data.public_metrics?.followers_count, raw: me.data.public_metrics };
  },
  async postMetrics({ accessToken, externalIds }) {
    const out: Record<string, Metrics> = {};
    for (let i = 0; i < externalIds.length; i += 100) {
      const r = await req<any>("x", `${API}/tweets?ids=${externalIds.slice(i, i + 100).join(",")}&tweet.fields=public_metrics`, { headers: { Authorization: `Bearer ${accessToken}` } });
      for (const t of r.data ?? []) {
        const p = t.public_metrics ?? {};
        out[t.id] = { impressions: p.impression_count, likes: p.like_count, comments: p.reply_count, shares: (p.retweet_count ?? 0) + (p.quote_count ?? 0), saves: p.bookmark_count, raw: p };
      }
    }
    return out;
  },
};
