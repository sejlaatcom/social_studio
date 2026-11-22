import { req, form, sleep } from "./http";
import { IntegrationError, type IntegrationProvider, type PlatformPublisher, type Metrics } from "./types";

// Instagram API with Instagram Login (Business/Creator accounts).
const GV = process.env.INSTAGRAM_GRAPH_VERSION ?? "v23.0";
const G = `https://graph.instagram.com/${GV}`;
const SCOPES = ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_comments", "instagram_business_manage_insights"];

export const instagramProvider: IntegrationProvider = {
  id: "instagram", name: "Instagram (Meta)", platforms: ["instagram"], envPrefix: "INSTAGRAM",
  docsUrl: "https://developers.facebook.com/apps", usesPkce: false,
  scopesFor: () => SCOPES,
  authUrl({ app, redirectUri, state }) {
    return `https://www.instagram.com/oauth/authorize?${form({ client_id: app.clientId, redirect_uri: redirectUri, response_type: "code", scope: SCOPES.join(","), state, enable_fb_login: "0", force_authentication: "1" })}`;
  },
  async exchangeCode({ app, code, redirectUri }) {
    const short = await req<any>("instagram", "https://api.instagram.com/oauth/access_token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form({ client_id: app.clientId, client_secret: app.clientSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code }), retries: 0 });
    const s = short.data?.[0] ?? short;
    const long = await req<any>("instagram", `https://graph.instagram.com/access_token?${form({ grant_type: "ig_exchange_token", client_secret: app.clientSecret, access_token: s.access_token })}`);
    const perms = typeof s.permissions === "string" ? s.permissions.split(",") : (s.permissions ?? SCOPES);
    return { accessToken: long.access_token, refreshToken: null, expiresIn: long.expires_in, scopes: perms, externalUserId: String(s.user_id) };
  },
  async refresh({ accessToken }) {
    const r = await req<any>("instagram", `https://graph.instagram.com/refresh_access_token?${form({ grant_type: "ig_refresh_token", access_token: accessToken })}`, { retries: 1 });
    return { accessToken: r.access_token, refreshToken: null, expiresIn: r.expires_in, scopes: SCOPES };
  },
  async discoverAccounts({ accessToken }) {
    const me = await req<any>("instagram", `${G}/me?fields=user_id,username,name,profile_picture_url,followers_count,media_count,account_type&access_token=${accessToken}`);
    return [{ platform: "instagram", externalId: String(me.user_id ?? me.id), username: me.username, displayName: me.name || me.username, avatarUrl: me.profile_picture_url, followers: me.followers_count ?? null, meta: { accountType: me.account_type, mediaCount: me.media_count, igId: me.id } }];
  },
};

async function waitContainer(id: string, token: string) {
  for (let i = 0; i < 60; i++) {
    const s = await req<any>("instagram", `${G}/${id}?fields=status_code,status&access_token=${token}`);
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new IntegrationError("instagram", `فشلت معالجة الوسائط لدى Instagram: ${s.status ?? s.status_code}`);
    await sleep(5000);
  }
  throw new IntegrationError("instagram", "انتهت مهلة معالجة الوسائط لدى Instagram", { retryable: true });
}

async function container(userId: string, token: string, params: Record<string, string>) {
  const r = await req<any>("instagram", `${G}/${userId}/media`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ ...params, access_token: token }) });
  return r.id as string;
}

export const instagramPublisher: PlatformPublisher = {
  platform: "instagram",
  async publish(i) {
    const uid = i.account.externalId; const t = i.accessToken;
    const caption = [i.text, i.hashtags.join(" ")].filter(Boolean).join("\n\n");
    if (i.media.length === 0) throw new IntegrationError("instagram", "يتطلب Instagram صورة أو فيديو واحدًا على الأقل");
    let creation: string;
    const isVideo = (m: { mimeType: string }) => m.mimeType.startsWith("video/");
    if (i.format === "carousel" && i.media.length > 1) {
      const children: string[] = [];
      for (const m of i.media.slice(0, 10)) {
        const c = await container(uid, t, isVideo(m) ? { media_type: "VIDEO", video_url: m.publicUrl, is_carousel_item: "true" } : { image_url: m.publicUrl, is_carousel_item: "true", ...(m.altText ? { alt_text: m.altText } : {}) });
        if (isVideo(m)) await waitContainer(c, t);
        children.push(c);
      }
      creation = await container(uid, t, { media_type: "CAROUSEL", children: children.join(","), caption });
    } else if (i.format === "story") {
      const m = i.media[0];
      creation = await container(uid, t, isVideo(m) ? { media_type: "STORIES", video_url: m.publicUrl } : { media_type: "STORIES", image_url: m.publicUrl });
    } else if (i.format === "reel" || isVideo(i.media[0])) {
      const m = i.media.find(isVideo);
      if (!m) throw new IntegrationError("instagram", "Reels تتطلب ملف فيديو");
      const cover = i.media.find((x) => x.mimeType.startsWith("image/"));
      creation = await container(uid, t, { media_type: "REELS", video_url: m.publicUrl, caption, share_to_feed: "true", ...(cover ? { cover_url: cover.publicUrl } : {}) });
    } else {
      const m = i.media[0];
      creation = await container(uid, t, { image_url: m.publicUrl, caption, ...(m.altText ? { alt_text: m.altText } : {}) });
    }
    await waitContainer(creation, t);
    const pub = await req<any>("instagram", `${G}/${uid}/media_publish`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ creation_id: creation, access_token: t }) });
    const info = await req<any>("instagram", `${G}/${pub.id}?fields=permalink&access_token=${t}`).catch(() => ({}));
    return { externalId: pub.id, url: info.permalink ?? null, raw: pub };
  },
  async accountMetrics({ accessToken }) {
    const me = await req<any>("instagram", `${G}/me?fields=followers_count,media_count&access_token=${accessToken}`);
    return { followers: me.followers_count, raw: me };
  },
  async postMetrics({ accessToken, externalIds }) {
    const out: Record<string, Metrics> = {};
    for (const id of externalIds) {
      try {
        const r = await req<any>("instagram", `${G}/${id}/insights?metric=reach,likes,comments,shares,saved,views&access_token=${accessToken}`);
        const v = (n: string) => r.data?.find((d: any) => d.name === n)?.values?.[0]?.value ?? r.data?.find((d: any) => d.name === n)?.total_value?.value;
        out[id] = { reach: v("reach"), likes: v("likes"), comments: v("comments"), shares: v("shares"), saves: v("saved"), views: v("views"), raw: r.data };
      } catch (e) { console.warn("[instagram] insights failed", id, (e as Error).message); }
    }
    return out;
  },
  async fetchComments({ accessToken, externalPostIds }) {
    const out = [];
    for (const pid of externalPostIds.slice(0, 25)) {
      const r = await req<any>("instagram", `${G}/${pid}/comments?fields=id,text,username,timestamp&access_token=${accessToken}`).catch(() => ({ data: [] }));
      for (const c of r.data ?? []) out.push({ externalId: c.id, externalPostId: pid, authorName: c.username ?? "", authorHandle: c.username, text: c.text ?? "", postedAt: new Date(c.timestamp) });
    }
    return out;
  },
  async replyComment({ accessToken, commentId, text }) {
    await req("instagram", `${G}/${commentId}/replies`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ message: text, access_token: accessToken }) });
  },
};
