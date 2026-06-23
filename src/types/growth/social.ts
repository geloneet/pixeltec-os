import type { Timestamp } from 'firebase-admin/firestore';

export type SocialPlatformType = 'instagram' | 'facebook';

export type SocialAccountStatus = 'connected' | 'expired' | 'error';

export interface SocialAccount {
  // Collection: growthSocialAccounts/{id}
  id: string;
  uid: string;

  platform: SocialPlatformType;
  status: SocialAccountStatus;

  // Facebook
  facebookUserId: string;
  facebookPageId: string;
  facebookPageName: string;
  accessToken: string;
  tokenExpiresAt: string; // ISO string — long-lived tokens expire in ~60 days

  // Instagram Business (linked to Facebook Page)
  instagramBusinessId?: string;
  instagramUsername?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PublishResult {
  ok: boolean;
  platform: SocialPlatformType;
  publishedId?: string;
  publishedUrl?: string;
  error?: string;
}
