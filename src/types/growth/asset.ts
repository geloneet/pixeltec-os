import type { Timestamp } from 'firebase-admin/firestore';

export type AssetType =
  | 'logo'
  | 'brand_photo'
  | 'generated_image'
  | 'generated_post'
  | 'svg_template'
  | 'upload';

export interface Asset {
  id: string;
  uid: string;
  brandId?: string;
  type: AssetType;
  url: string;
  storagePath: string;
  thumbnailUrl?: string;
  name: string;
  tags: string[];
  size: number;
  dimensions?: { width: number; height: number };
  mimeType: string;
  linkedPostId?: string;
  linkedCampaignId?: string;
  isUserUploaded: boolean;
  createdAt: Timestamp;
}
