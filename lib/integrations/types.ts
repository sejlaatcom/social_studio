import type { Platform } from "../platforms";

export type ProviderId = "google" | "instagram" | "x" | "tiktok" | "snapchat";
export type AppCreds = { clientId: string; clientSecret: string };
export type TokenSet = { accessToken: string; refreshToken?: string | null; expiresIn?: number | null; scopes: string[]; tokenType?: string; externalUserId?: string };
export type DiscoveredAccount = { platform: Platform; externalId: string; username?: string | null; displayName: string; avatarUrl?: string | null; followers?: number | null; meta?: Record<string, unknown> };

export type MediaInput = { assetId: string; mimeType: string; localPath: string; publicUrl: string; sizeBytes: number; width?: number | null; height?: number | null; durationSec?: number | null; altText?: string | null };
export type PublishInput = {
  account: { externalId: string; username?: string | null; meta?: Record<string, unknown> | null };
  accessToken: string; format: string; text: string; title?: string | null; hashtags: string[]; threadParts: string[]; pollOptions: string[];
  options: Record<string, unknown>; media: MediaInput[]; scheduledAt?: Date | null;
};
export type PublishResult = { externalId: string; url?: string | null; raw?: unknown };

export type Metrics = { followers?: number; impressions?: number; reach?: number; views?: number; likes?: number; comments?: number; shares?: number; saves?: number; raw?: unknown };

export interface IntegrationProvider {
  id: ProviderId;
  name: string;
  platforms: Platform[];
  envPrefix: string; // e.g. GOOGLE → GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
  docsUrl: string;
  scopesFor(platform?: Platform): string[];
  usesPkce: boolean;
  authUrl(o: { app: AppCreds; redirectUri: string; state: string; codeChallenge?: string; platform?: Platform }): string;
  exchangeCode(o: { app: AppCreds; code: string; redirectUri: string; codeVerifier?: string | null }): Promise<TokenSet>;
  refresh(o: { app: AppCreds; refreshToken: string | null; accessToken: string }): Promise<TokenSet>;
  revoke?(o: { app: AppCreds; token: string }): Promise<void>;
  discoverAccounts(o: { accessToken: string; tokens: TokenSet; platform?: Platform; scopes: string[] }): Promise<DiscoveredAccount[]>;
}

export interface PlatformPublisher {
  platform: Platform;
  publish(i: PublishInput): Promise<PublishResult>;
  accountMetrics?(o: { accessToken: string; account: { externalId: string; meta?: Record<string, unknown> | null } }): Promise<Metrics>;
  postMetrics?(o: { accessToken: string; account: { externalId: string; meta?: Record<string, unknown> | null }; externalIds: string[] }): Promise<Record<string, Metrics>>;
  fetchComments?(o: { accessToken: string; account: { externalId: string; meta?: Record<string, unknown> | null }; externalPostIds: string[] }): Promise<{ externalId: string; externalPostId: string; authorName: string; authorHandle?: string; text: string; postedAt: Date }[]>;
  replyComment?(o: { accessToken: string; commentId: string; text: string }): Promise<void>;
}

export class IntegrationError extends Error {
  constructor(public provider: string, message: string, public opts: { status?: number; retryable?: boolean; needsReauth?: boolean; body?: unknown } = {}) { super(message); }
}
