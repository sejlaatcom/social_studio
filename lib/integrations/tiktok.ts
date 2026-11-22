import fs from "node:fs";
import { req, form, sleep } from "./http";
import { IntegrationError, type IntegrationProvider, type PlatformPublisher, type Metrics } from "./types";

const API = "https://open.tiktokapis.com/v2";
const SCOPES = ["user.info.basic", "user.info.profile", "user.info.stats", "video.publish", "video.upload", "video.list"];

export const tiktokProvider: IntegrationProvider = {
  id: "tiktok", name: "TikTok", platforms: ["tiktok"], envPrefix: "TIKTOK", docsUrl: "https://developers.tiktok.com/apps", usesPkce: false,
  scopesFor: () => SCOPES,
  authUrl({ app, redirectUri, state }) {
    return `https://www.tiktok.com/v2/auth/authorize/?${form({ client_key: app.clientId, scope: SCOPES.join(","), response_type: "code", redirect_uri: redirectUri, state })}`;
  },
  async exchangeCode({ app, code, redirectUri }) {
    const t = await req<any>("tiktok", `${API}/oauth/token/`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form({ client_key: app.clientId, client_secret: app.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }), retries: 0 });
    if (t.error) throw new IntegrationError("tiktok", t.error_description ?? t.error);
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresIn: t.expires_in, scopes: String(t.scope ?? "").split(","), externalUserId: t.open_id };
  },
  async refresh({ app, refreshToken }) {
    const t = await req<any>("tiktok", `${API}/oauth/token/`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form({ client_key: app.clientId, client_secret: app.clientSecret, grant_type: "refresh_token", refresh_token: refreshToken ?? "" }), retries: 1 });
    if (t.error) throw new IntegrationError("tiktok", t.error_description ?? t.error, { needsReauth: true });
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresIn: t.expires_in, scopes: String(t.scope ?? "").split(",") };
  },
  async revoke({ app, token }) {
    await req("tiktok", `${API}/oauth/revoke/`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ client_key: app.clientId, client_secret: app.clientSecret, token }), retries: 0 }).catch(() => undefined);
  },
  async discoverAccounts({ accessToken }) {
    const r = await req<any>("tiktok", `${API}/user/info/?fields=open_id,union_id,avatar_url,display_name,username,follower_count`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const u = r.data.user;
    return [{ platform: "tiktok", externalId: u.open_id, username: u.username ?? null, displayName: u.display_name, avatarUrl: u.avatar_url, followers: u.follower_count ?? null }];
  },
};

function check(r: any) {
  if (r?.error?.code && r.error.code !== "ok") throw new IntegrationError("tiktok", `TikTok: ${r.error.message || r.error.code}`, { needsReauth: r.error.code === "access_token_invalid" });
  return r;
}

export async function tiktokCreatorInfo(token: string) {
  return check(await req<any>("tiktok", `${API}/post/publish/creator_info/query/`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8" } })).data;
}

export const tiktokPublisher: PlatformPublisher = {
  platform: "tiktok",
  async publish(i) {
    const video = i.media.find((m) => m.mimeType.startsWith("video/"));
    if (!video) throw new IntegrationError("tiktok", "يتطلب TikTok ملف فيديو");
    const auth = { Authorization: `Bearer ${i.accessToken}`, "content-type": "application/json; charset=UTF-8" };
    const creator = await tiktokCreatorInfo(i.accessToken);
    const allowed: string[] = creator.privacy_level_options ?? ["SELF_ONLY"];
    const wanted = String(i.options.privacyLevel ?? "PUBLIC_TO_EVERYONE");
    const privacy = allowed.includes(wanted) ? wanted : allowed.includes("SELF_ONLY") ? "SELF_ONLY" : allowed[0];
    const size = video.sizeBytes;
    const CHUNK = size <= 64 * 1024 * 1024 ? size : 10 * 1024 * 1024;
    const chunks = Math.max(1, Math.floor(size / CHUNK));
    const init = check(await req<any>("tiktok", `${API}/post/publish/video/init/`, {
      method: "POST", headers: auth, retries: 1,
      body: JSON.stringify({
        post_info: { title: [i.text, i.hashtags.join(" ")].filter(Boolean).join(" ").slice(0, 2200), privacy_level: privacy,
          disable_comment: Boolean(i.options.disableComment), disable_duet: Boolean(i.options.disableDuet), disable_stitch: Boolean(i.options.disableStitch),
          video_cover_timestamp_ms: Number(i.options.coverTimestampMs ?? 1000), brand_content_toggle: Boolean(i.options.brandedContent), brand_organic_toggle: Boolean(i.options.yourBrand) },
        source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: CHUNK, total_chunk_count: chunks },
      }),
    })).data;
    const buf = fs.readFileSync(video.localPath);
    for (let c = 0; c < chunks; c++) {
      const start = c * CHUNK; const end = c === chunks - 1 ? size : start + CHUNK;
      await req("tiktok", init.upload_url, { method: "PUT", headers: { "content-type": video.mimeType, "content-range": `bytes ${start}-${end - 1}/${size}`, "content-length": String(end - start) }, body: buf.subarray(start, end), retries: 2 });
    }
    for (let n = 0; n < 60; n++) {
      await sleep(5000);
      const s = check(await req<any>("tiktok", `${API}/post/publish/status/fetch/`, { method: "POST", headers: auth, body: JSON.stringify({ publish_id: init.publish_id }) })).data;
      if (s.status === "PUBLISH_COMPLETE") {
        const vid = s.publicaly_available_post_id?.[0];
        return { externalId: vid ? String(vid) : init.publish_id, url: vid ? `https://www.tiktok.com/@${i.account.username ?? ""}/video/${vid}` : null, raw: { ...s, privacy } };
      }
      if (s.status === "FAILED") throw new IntegrationError("tiktok", `فشل النشر على TikTok: ${s.fail_reason ?? "unknown"}`);
    }
    throw new IntegrationError("tiktok", "انتهت مهلة انتظار تأكيد النشر من TikTok", { retryable: false });
  },
  async accountMetrics({ accessToken }) {
    const r = await req<any>("tiktok", `${API}/user/info/?fields=follower_count,likes_count,video_count`, { headers: { Authorization: `Bearer ${accessToken}` } });
    return { followers: r.data.user.follower_count, likes: r.data.user.likes_count, raw: r.data.user };
  },
  async postMetrics({ accessToken, externalIds }) {
    const out: Record<string, Metrics> = {};
    for (let i = 0; i < externalIds.length; i += 20) {
      const r = check(await req<any>("tiktok", `${API}/video/query/?fields=id,view_count,like_count,comment_count,share_count`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ filters: { video_ids: externalIds.slice(i, i + 20) } }) }));
      for (const v of r.data?.videos ?? []) out[v.id] = { views: v.view_count, likes: v.like_count, comments: v.comment_count, shares: v.share_count, raw: v };
    }
    return out;
  },
};

export async function tiktokVideoList(token: string) {
  const r = check(await req<any>("tiktok", `${API}/video/list/?fields=id,title,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ max_count: 20 }) }));
  return r.data?.videos ?? [];
}
