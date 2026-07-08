import type { TemplateFormat } from './template';

export interface BrandBrain {
  id: string;
  uid: string;

  name: string;

  identity: BrandIdentity;
  voice: BrandVoice;
  business: BrandBusiness;
  positioning: BrandPositioning;
  objections: ObjectionResponse[];
  contentRules: ContentRules;

  // Calculated client-side — NOT stored in Firestore
  completionScore?: number;
  isComplete?: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface BrandIdentity {
  logoUrl?: string;
  logoStoragePath?: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    heading: string;
    body: string;
  };
}

export interface BrandVoice {
  personality: string[];
  avoid: string[];
  language: 'es' | 'en' | 'pt';
  formality: 'formal' | 'semi_formal' | 'casual';
  examplePosts: string[];
  forbiddenTopics: string[];
}

export interface BrandBusiness {
  industry: string;
  subIndustry?: string;
  location: string;
  yearsInBusiness?: number;
  teamSize?: string;
  services: BrandService[];
  certifications: string[];
}

export interface BrandService {
  id: string;
  name: string;
  description: string;
  price?: string;
  duration?: string;
  targetPain: string;
  benefit: string;
  isHighlight: boolean;
}

export interface BrandPositioning {
  valueProps: string[];
  differentiators: string[];
  competitorContext?: string;
  targetAudience: ICP;
  pricePosition: 'economy' | 'mid_range' | 'premium' | 'luxury';
}

export interface ICP {
  ageRange?: string;
  gender?: string;
  income?: string;
  location?: string;
  painPoints: string[];
  goals: string[];
  triggers: string[];
}

export interface ObjectionResponse {
  id: string;
  objection: string;
  response: string;
  contentHook?: string;
}

export interface ContentRules {
  preferredFormats: TemplateFormat[];
  postingFrequency?: string;
  hashtagStrategy?: string;
  callToActions: string[];
  contentPillars: string[];
}
