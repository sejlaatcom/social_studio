import { req, form } from "./http";
import { IntegrationError, type IntegrationProvider, type PlatformPublisher } from "./types";

// Snapchat Marketing API (ads). Organic Story posting has no public API → manual publishing flow.
const ADS = "https://adsapi.snapchat.com/v1";
const SCOPES = ["snapchat-marketing-api"];

export const snapchatProvider: IntegrationProvider = {
  id: "snapchat", name: "Snapchat (Marketing API)", platforms: ["snapchat"], envPrefix: "SNAPCHAT", docsUrl: "https://business.snapchat.com", usesPkce: false,
  scopesFor: () => SCOPES,
  authUrl({ app, redirectUri, state }) {
    return `https://accounts.snapchat.com/login/oauth2/authorize?${form({ client_id: app.clientId, redirect_uri: redirectUri, response_type: "code", scope: SCOPES.join(" "), state })}`;
  },
  async exchangeCode({ app, code, redirectUri }) {
    const t = await req<any>("snapchat", "https://accounts.snapchat.com/login/oauth2/access_token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form({ grant_type: "authorization_code", client_id: app.clientId, client_secret: app.clientSecret, code, redirect_uri: redirectUri }), retries: 0 });
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresIn: t.expires_in, scopes: SCOPES };
  },
  async refresh({ app, refreshToken }) {
    const t = await req<any>("snapchat", "https://accounts.snapchat.com/login/oauth2/access_token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form({ grant_type: "refresh_token", client_id: app.clientId, client_secret: app.clientSecret, refresh_token: refreshToken ?? "" }), retries: 1 });
    return { accessToken: t.access_token, refreshToken: t.refresh_token ?? refreshToken, expiresIn: t.expires_in, scopes: SCOPES };
  },
  async discoverAccounts({ accessToken }) {
    const auth = { Authorization: `Bearer ${accessToken}` };
    const me = await req<any>("snapchat", `${ADS}/me`, { headers: auth });
    const orgs = await req<any>("snapchat", `${ADS}/me/organizations?with_ad_accounts=true`, { headers: auth });
    const adAccounts = (orgs.organizations ?? []).flatMap((o: any) => (o.organization?.ad_accounts ?? []).map((a: any) => ({ id: a.id, name: a.name, currency: a.currency, organization: o.organization.name })));
    return [{ platform: "snapchat", externalId: me.me.id, username: me.me.email ?? null, displayName: me.me.display_name ?? me.me.email ?? "Snapchat Business", meta: { adAccounts } }];
  },
};

export const snapchatPublisher: PlatformPublisher = {
  platform: "snapchat",
  async publish() {
    throw new IntegrationError("snapchat", "MANUAL_REQUIRED: لا تتوفر API رسمية لنشر محتوى Snapchat العضوي. استخدم حزمة النشر اليدوي.");
  },
};

export async function snapAdCampaigns(token: string, adAccountId: string) {
  const r = await req<any>("snapchat", `${ADS}/adaccounts/${adAccountId}/campaigns`, { headers: { Authorization: `Bearer ${token}` } });
  return (r.campaigns ?? []).map((c: any) => c.campaign);
}
export async function snapCreateCampaign(token: string, adAccountId: string, c: { name: string; startTime: string; dailyBudgetMicro?: number }) {
  const r = await req<any>("snapchat", `${ADS}/adaccounts/${adAccountId}/campaigns`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ campaigns: [{ name: c.name, ad_account_id: adAccountId, status: "PAUSED", start_time: c.startTime, ...(c.dailyBudgetMicro ? { daily_budget_micro: c.dailyBudgetMicro } : {}) }] }),
  });
  const res = r.campaigns?.[0];
  if (res?.sub_request_status !== "SUCCESS") throw new IntegrationError("snapchat", res?.sub_request_error_reason ?? "تعذر إنشاء الحملة");
  return res.campaign;
}
export async function snapCampaignStats(token: string, campaignId: string) {
  const r = await req<any>("snapchat", `${ADS}/campaigns/${campaignId}/stats?granularity=TOTAL&fields=impressions,swipes,spend,video_views`, { headers: { Authorization: `Bearer ${token}` } });
  return r.total_stats?.[0]?.total_stat?.stats ?? {};
}
