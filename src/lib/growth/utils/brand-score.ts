import type { BrandBrain } from '@/types/growth/brand-brain';

interface ScoreBreakdown {
  identity: number;
  business: number;
  positioning: number;
  voice: number;
  objections: number;
  total: number;
}

export function computeBrandScore(brand: Partial<BrandBrain>): number {
  return computeBrandScoreDetailed(brand).total;
}

export function computeBrandScoreDetailed(brand: Partial<BrandBrain>): ScoreBreakdown {
  let identity = 0;
  let business = 0;
  let positioning = 0;
  let voice = 0;
  let objections = 0;

  // Identity (25 pts)
  if (brand.identity?.logoUrl) identity += 10;
  if (brand.identity?.colors?.primary && brand.identity?.colors?.secondary) identity += 10;
  if (brand.identity?.typography?.heading) identity += 5;

  // Business (30 pts)
  if (brand.business?.industry) business += 10;
  if (brand.business?.services && brand.business.services.length >= 1) {
    const complete = brand.business.services.filter(
      (s) => s.name && s.description && s.targetPain && s.benefit
    );
    if (complete.length >= 1) business += 20;
  }

  // Positioning (20 pts)
  if (brand.positioning?.valueProps && brand.positioning.valueProps.length >= 2) positioning += 10;
  if (
    brand.positioning?.targetAudience?.painPoints &&
    brand.positioning.targetAudience.painPoints.length >= 2
  ) {
    positioning += 10;
  }

  // Voice (20 pts)
  if (brand.voice?.personality && brand.voice.personality.length >= 2) voice += 5;
  if (brand.voice?.examplePosts && brand.voice.examplePosts.length >= 1) voice += 10;
  if (brand.contentRules?.callToActions && brand.contentRules.callToActions.length >= 1) voice += 5;

  // Objections (5 pts)
  if (brand.objections && brand.objections.length >= 2) objections += 5;

  const total = Math.min(100, identity + business + positioning + voice + objections);
  return { identity, business, positioning, voice, objections, total };
}

export function isBrandComplete(brand: Partial<BrandBrain>): boolean {
  return computeBrandScore(brand) >= 80;
}

export function isBrandUsable(brand: Partial<BrandBrain>): boolean {
  return computeBrandScore(brand) >= 60;
}
