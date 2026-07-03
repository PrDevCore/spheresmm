export type SocialPlatform = "twitter" | "linkedin" | "facebook" | "instagram";

export interface SocialAccount {
  id: string;
  userId: string;
  platform: SocialPlatform;
  username: string;
  displayName: string;
  avatarUrl: string;
  status: "active" | "expired";
  followerCount: number;
  accessToken: string;
  externalAccountId: string;
  createdAt: string;
}

export type PostStatus = "draft" | "scheduled" | "published" | "failed";

export interface Post {
  id: string;
  userId: string;
  content: string;
  mediaUrl?: string;
  platforms: SocialPlatform[];
  accountIds: string[];
  status: PostStatus;
  scheduledFor?: string; // ISO string
  publishedAt?: string; // ISO string
  createdAt: string; // ISO string
}

export interface AnalyticSnapshot {
  id: string;
  accountId: string;
  userId: string;
  platform: SocialPlatform;
  date: string; // YYYY-MM-DD
  impressions: number;
  engagements: number;
  clicks: number;
  followers: number;
}
