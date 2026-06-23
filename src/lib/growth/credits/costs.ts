export const CREDIT_COSTS = {
  brand_suggestion: 1,
  post_text_only: 2,
  post_image_flux: 6,
  post_image_ideogram: 6,
  post_complete: 8,
  // Variant operations — split to avoid negative-margin bundling
  post_variant_text_only: 2,
  post_variant_image_only: 6,
  post_variant_both: 8,
  campaign_strategy: 3,
  campaign_post: 8,
  image_regeneration: 5,
  text_regeneration: 2,
} as const;

export type CreditOperation = keyof typeof CREDIT_COSTS;
