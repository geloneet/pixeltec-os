
export type TemplateFormat =
  | 'instagram_post'
  | 'instagram_story'
  | 'instagram_carousel_slide'
  | 'facebook_post'
  | 'linkedin_post'
  | 'twitter_post'
  | 'banner_web'
  | 'email_header';

export type TemplateCategory =
  | 'servicio'
  | 'testimonio'
  | 'educativo'
  | 'promocion'
  | 'historia'
  | 'anuncio'
  | 'fecha_especial'
  | 'behind_scenes';

export type ZoneType = 'text' | 'image' | 'logo' | 'background' | 'accent' | 'price' | 'icon';

export type AIZoneRole =
  | 'headline'
  | 'body'
  | 'cta'
  | 'hashtags'
  | 'price_label'
  | 'image_prompt'
  | 'brand_logo'
  | 'brand_color'
  | null;

export interface TemplateZone {
  id: string;
  type: ZoneType;
  locked: boolean;
  aiRole: AIZoneRole;
  maxLength?: number;
  required: boolean;
}

export interface TemplateBrandVariable {
  placeholder: string;
  path: string;
  fallback: string;
}

export interface Template {
  id: string;
  uid: string | 'global';
  name: string;
  description?: string;

  format: TemplateFormat;
  dimensions: { width: number; height: number };

  // Stored in Firebase Storage — NOT in this document
  svgTemplateUrl: string;
  thumbnailUrl: string;

  zones: TemplateZone[];
  brandVariables: TemplateBrandVariable[];

  category: TemplateCategory;
  industries: string[];
  tags: string[];
  isActive: boolean;

  schemaVersion: number;

  createdAt: Date;
  updatedAt: Date;
}

export const TEMPLATE_FORMAT_LABELS: Record<TemplateFormat, string> = {
  instagram_post: 'Instagram Post',
  instagram_story: 'Instagram Story',
  instagram_carousel_slide: 'Carrusel (slide)',
  facebook_post: 'Facebook Post',
  linkedin_post: 'LinkedIn Post',
  twitter_post: 'Twitter / X Post',
  banner_web: 'Banner Web',
  email_header: 'Email Header',
};

export const TEMPLATE_FORMAT_DIMENSIONS: Record<TemplateFormat, { width: number; height: number }> = {
  instagram_post: { width: 1080, height: 1080 },
  instagram_story: { width: 1080, height: 1920 },
  instagram_carousel_slide: { width: 1080, height: 1080 },
  facebook_post: { width: 1200, height: 630 },
  linkedin_post: { width: 1200, height: 627 },
  twitter_post: { width: 1600, height: 900 },
  banner_web: { width: 1200, height: 400 },
  email_header: { width: 600, height: 200 },
};
