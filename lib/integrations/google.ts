import fs from "node:fs";
import { req, form } from "./http";
import { IntegrationError, type IntegrationProvider, type PlatformPublisher, type Metrics } from "./types";
import type { Platform } from "../platforms";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const YT = "https://www.googleapis.com/youtube/v3";
const SCOPES: Record<string, string[]> = {
  gmail: ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.compose"],
  youtube: ["openid", "email", "profile", "https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.force-ssl"],
};

export const googleProvider: IntegrationProvider = {
  id: "google", name: "Google (Gmail / YouTube)", platforms: ["gmail", "youtube"], envPrefix: "GOOGLE",
  docsUrl: "https://console.cloud.google.com/apis/credentials", usesPkce: true,
  scopesFor: (p) => SCOPES[p ?? "gmail"] ?? SCOPES.gmail,
  authUrl({ app, redirectUri, state, codeChallenge, platform }) {
    const u = new URL(AUTH);
    u.search = form({
      client_id: app.clientId, redirect_uri: redirectUri, response_type: "code", state,
      scope: (SCOPES[platform ?? "gmail"] ?? SCOPES.gmail).join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true",
      code_challenge: codeChallenge!, code_challenge_method: "S256",
    });
    return u.toString();
  },
  async exchangeCode({ app, code, redirectUri, codeVerifier }) {
    const t = await req<any>("google", TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form({ code, client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: codeVerifier ?? "" }), retries: 0 });
    const info = await req<any>("google", "https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } });
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresIn: t.expires_in, scopes: String(t.scope ?? "").split(" "), tokenType: t.token_type, externalUserId: info.sub };
  },
  async refresh({ app, refreshToken }) {
    if (!refreshToken) throw new IntegrationError("google", "لا يوجد refresh token؛ أعد الربط", { needsReauth: true });
    const t = await req<any>("google", TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form({ client_id: app.clientId, client_secret: app.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }), retries: 1 });
    return { accessToken: t.access_token, refreshToken: t.refresh_token ?? refreshToken, expiresIn: t.expires_in, scopes: String(t.scope ?? "").split(" ") };
  },
  async revoke({ token }) {
    await req("google", `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, retries: 0 }).catch(() => undefined);
  },
  async discoverAccounts({ accessToken, scopes, platform }) {
    const out = [];
    const auth = { Authorization: `Bearer ${accessToken}` };
    const info = await req<any>("google", "https://openidconnect.googleapis.com/v1/userinfo", { headers: auth });
    if ((platform ?? "gmail") === "gmail" && scopes.some((s) => s.includes("gmail.send"))) {
      const prof = await req<any>("google", "https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: auth });
      out.push({ platform: "gmail" as Platform, externalId: prof.emailAddress, username: prof.emailAddress, displayName: info.name ?? prof.emailAddress, avatarUrl: info.picture, meta: { messagesTotal: prof.messagesTotal } });
    }
    if (platform === "youtube" && scopes.some((s) => s.includes("youtube"))) {
      const ch = await req<any>("google", `${YT}/channels?part=snippet,statistics,contentDetails&mine=true`, { headers: auth });
      for (const c of ch.items ?? []) {
        out.push({ platform: "youtube" as Platform, externalId: c.id, username: c.snippet.customUrl ?? null, displayName: c.snippet.title, avatarUrl: c.snippet.thumbnails?.default?.url,
          followers: c.statistics?.hiddenSubscriberCount ? null : Number(c.statistics?.subscriberCount ?? 0), meta: { uploadsPlaylist: c.contentDetails?.relatedPlaylists?.uploads } });
      }
      if (!ch.items?.length) throw new IntegrationError("google", "لا توجد قناة YouTube مرتبطة بهذا الحساب");
    }
    return out;
  },
};

// ───── Gmail ─────
function encodeHeader(v: string) { return /[^\x20-\x7e]/.test(v) ? `=?UTF-8?B?${Buffer.from(v).toString("base64")}?=` : v; }
export function buildMime(o: { from: string; to: string; subject: string; html: string; text?: string; listUnsubscribe?: string }) {
  const boundary = "ss_" + Math.random().toString(36).slice(2);
  const lines = [
    `From: ${o.from}`, `To: ${o.to}`, `Subject: ${encodeHeader(o.subject)}`, "MIME-Version: 1.0",
    ...(o.listUnsubscribe ? [`List-Unsubscribe: <${o.listUnsubscribe}>`] : []),
    `Content-Type: multipart/alternative; boundary="${boundary}"`, "",
    `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(o.text ?? o.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).toString("base64"),
    `--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(o.html).toString("base64"),
    `--${boundary}--`,
  ];
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}
export async function gmailSend(accessToken: string, raw: string) {
  return req<{ id: string; threadId: string }>("gmail", "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ raw }), retries: 2,
  });
}
export async function gmailDraft(accessToken: string, raw: string) {
  return req<{ id: string }>("gmail", "https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ message: { raw } }),
  });
}

export const gmailPublisher: PlatformPublisher = {
  platform: "gmail",
  async publish(i) {
    const to = String(i.options.to ?? "").trim();
    if (!to) throw new IntegrationError("gmail", "حدد عنوان المستلم في خيارات منشور البريد");
    const raw = buildMime({ from: i.account.externalId, to, subject: i.title ?? "(بدون عنوان)", html: String(i.options.html ?? i.text.replace(/\n/g, "<br>")) });
    const r = await gmailSend(i.accessToken, raw);
    return { externalId: r.id, url: `https://mail.google.com/mail/u/0/#sent/${r.threadId}` };
  },
};

// ───── YouTube ─────
export const youtubePublisher: PlatformPublisher = {
  platform: "youtube",
  async publish(i) {
    const video = i.media.find((m) => m.mimeType.startsWith("video/"));
    if (!video) throw new IntegrationError("youtube", "يتطلب YouTube ملف فيديو");
    const auth = { Authorization: `Bearer ${i.accessToken}` };
    const isShort = i.format === "short";
    const title = (i.title || i.text.split("\n")[0] || "Untitled").slice(0, 100) + (isShort && !/#shorts/i.test(i.title ?? "") ? "" : "");
    const description = [i.text, i.hashtags.join(" "), isShort ? "#Shorts" : ""].filter(Boolean).join("\n\n").slice(0, 5000);
    const privacy = String(i.options.privacyStatus ?? "public");
    const status: Record<string, unknown> = { privacyStatus: privacy, selfDeclaredMadeForKids: Boolean(i.options.madeForKids ?? false) };
    // Native YouTube scheduling: upload as private with publishAt.
    if (i.options.useNativeSchedule && i.scheduledAt && i.scheduledAt > new Date()) { status.privacyStatus = "private"; status.publishAt = i.scheduledAt.toISOString(); }
    const meta = { snippet: { title, description, tags: (i.options.tags as string[] | undefined) ?? i.hashtags.map((h) => h.replace(/^#/, "")), categoryId: String(i.options.categoryId ?? "22"), defaultLanguage: i.options.language ?? "ar" }, status };
    const init = await req<Response>("youtube", "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST", raw: true, headers: { ...auth, "content-type": "application/json; charset=UTF-8", "X-Upload-Content-Type": video.mimeType, "X-Upload-Content-Length": String(video.sizeBytes) }, body: JSON.stringify(meta),
    });
    const location = init.headers.get("location");
    if (!location) throw new IntegrationError("youtube", "لم يُرجع YouTube رابط الرفع");
    const body = fs.readFileSync(video.localPath);
    const up = await req<any>("youtube", location, { method: "PUT", headers: { ...auth, "content-type": video.mimeType, "content-length": String(body.length) }, body, retries: 2 });
    const id = up.id as string;
    const thumb = i.media.find((m) => m.mimeType.startsWith("image/"));
    if (thumb) {
      await req("youtube", `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${id}`, { method: "POST", headers: { ...auth, "content-type": thumb.mimeType }, body: fs.readFileSync(thumb.localPath) })
        .catch((e) => console.warn("[youtube] thumbnail failed (account may need verification)", e.message));
    }
    if (i.options.playlistId) {
      await req("youtube", `${YT}/playlistItems?part=snippet`, { method: "POST", headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ snippet: { playlistId: i.options.playlistId, resourceId: { kind: "youtube#video", videoId: id } } }) });
    }
    return { externalId: id, url: isShort ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`, raw: up };
  },
  async accountMetrics({ accessToken, account }) {
    const r = await req<any>("youtube", `${YT}/channels?part=statistics&id=${account.externalId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const s = r.items?.[0]?.statistics ?? {};
    return { followers: s.hiddenSubscriberCount ? undefined : Number(s.subscriberCount ?? 0), views: Number(s.viewCount ?? 0), raw: s };
  },
  async postMetrics({ accessToken, externalIds }) {
    const out: Record<string, Metrics> = {};
    for (let i = 0; i < externalIds.length; i += 50) {
      const r = await req<any>("youtube", `${YT}/videos?part=statistics&id=${externalIds.slice(i, i + 50).join(",")}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      for (const v of r.items ?? []) out[v.id] = { views: Number(v.statistics.viewCount ?? 0), likes: Number(v.statistics.likeCount ?? 0), comments: Number(v.statistics.commentCount ?? 0), raw: v.statistics };
    }
    return out;
  },
  async fetchComments({ accessToken, account }) {
    const r = await req<any>("youtube", `${YT}/commentThreads?part=snippet&allThreadsRelatedToChannelId=${account.externalId}&maxResults=50&order=time`, { headers: { Authorization: `Bearer ${accessToken}` } });
    return (r.items ?? []).map((t: any) => {
      const s = t.snippet.topLevelComment.snippet;
      return { externalId: t.snippet.topLevelComment.id, externalPostId: t.snippet.videoId, authorName: s.authorDisplayName, authorHandle: s.authorChannelUrl, text: s.textOriginal, postedAt: new Date(s.publishedAt) };
    });
  },
  async replyComment({ accessToken, commentId, text }) {
    await req("youtube", `${YT}/comments?part=snippet`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ snippet: { parentId: commentId, textOriginal: text } }) });
  },
};

export async function youtubePlaylists(accessToken: string) {
  const r = await req<any>("youtube", `${YT}/playlists?part=snippet&mine=true&maxResults=50`, { headers: { Authorization: `Bearer ${accessToken}` } });
  return (r.items ?? []).map((p: any) => ({ id: p.id, title: p.snippet.title }));
}
export async function youtubeCreatePlaylist(accessToken: string, title: string, privacyStatus = "public") {
  return req<any>("youtube", `${YT}/playlists?part=snippet,status`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ snippet: { title }, status: { privacyStatus } }) });
}
