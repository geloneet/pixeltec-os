import type { Timestamp } from 'firebase-admin/firestore';
import type { TemplateFormat } from './template';
import type { SocialPlatform } from './post';

export type CampaignStatus =
  | 'planning'
  | 'strategy_ready'
  | 'generating'
  | 'review'
  | 'active'
  | 'completed'
  | 'archived';

export type CampaignPostPurpose =
  | 'awareness'
  | 'consideration'
  | 'conversion'
  | 'social_proof'
  | 'retention';

export interface CampaignPostPlan {
  planId: string;
  format: TemplateFormat;
  templateId: string;
  purpose: CampaignPostPurpose;
  keyMessage: string;
  postId?: string;
  status: 'pending' | 'generating' | 'done' | 'failed';
}

export interface CampaignStrategy {
  campaignName: string;
  angle: string;
  targetedPain: string;
  keyMessage: string;
  postPlans: CampaignPostPlan[];
  estimatedCredits: number;
  generatedAt: Timestamp;
}

export interface Campaign {
  id: string;
  uid: string;
  brandId: string;
  name: string;

  objective: string;
  targetAction: string;
  targetPlatforms: SocialPlatform[];

  status: CampaignStatus;

  strategy?: CampaignStrategy;

  // Counters updated via FieldValue.increment() — never embed post arrays here
  counters: {
    totalPosts: number;
    generatedPosts: number;
    approvedPosts: number;
    publishedPosts: number;
  };

  dateRange?: {
    startDate: Timestamp;
    endDate: Timestamp;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
