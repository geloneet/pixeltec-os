import type { TemplateFormat } from './template';

export type PostStatus =
  | 'generating'
  | 'draft'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'rejected';

export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'twitter';

export interface BrandSnapshot {
  id: string;
  name: string;
  industry: string;
  voiceSummary: string;
  primaryColor?: string;
  logoUrl?: string;
}

export interface GenerationMetadata {
  model: string;
  operation: string;
  creditsUsed: number;
  actualApiCost?: {
    textCost: number;
    imageCost: number;
    totalCost: number;
  };
}

export interface ScheduledPlatform {
  name: SocialPlatform;
  socialAccountId: string;
  status: 'pending' | 'published' | 'failed' | 'cancelled';
  publishedUrl?: string;
  error?: string;
  attemptedAt?: Date;
}

export interface ContentPost {
  id: string;
  uid: string;
  brandId: string;
  campaignId?: string;
  templateId?: string;

  status: PostStatus;
  format: TemplateFormat | string;

  caption: string;
  hashtags: string[];
  imageUrl?: string;
  altText?: string;
  suggestedTime?: string;

  brandSnapshot: BrandSnapshot;
  generationMetadata: GenerationMetadata;

  scheduledAt?: Date;
  publishedAt?: Date;
  scheduledPlatforms?: ScheduledPlatform[];

  variantGroupId?: string;
  variantIndex?: number;

  createdAt: Date;
  updatedAt: Date;
}
