import { z } from 'zod';

// ── WS2: piezas de estrategia/evidencia ──────────────────────────────────────

export const PostSourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3, 'Título de la fuente muy corto').max(300),
  url: z.string().url('URL de fuente inválida'),
  publisher: z.string().max(200).default(''),
  sourceType: z.enum([
    'official',
    'primary-research',
    'regulation',
    'technical-documentation',
    'reputable-secondary',
    'pixeltec-evidence',
  ]),
  claimSupported: z.string().max(500).default(''),
  accessedAt: z.string().default(''),
  verifiedByHuman: z.boolean().default(false),
});
export type PostSourceInput = z.infer<typeof PostSourceSchema>;

export const InternalLinkSchema = z.object({
  targetUrl: z.string().min(1).refine((u) => u.startsWith('/') || u.startsWith('https://pixeltec.mx'), {
    message: 'El enlace interno debe ser relativo (/ruta) o del propio dominio',
  }),
  anchor: z.string().min(2, 'Anchor descriptivo requerido').max(120),
  placement: z.string().max(200).optional(),
  verified: z.boolean().default(false),
});

export const BriefInternalLinkTargetSchema = z.object({
  url: z.string().min(1),
  purpose: z.string().max(300).default(''),
  suggestedAnchor: z.string().max(120).optional(),
});

const SearchIntentEnum = z.enum([
  'informational',
  'commercial-investigation',
  'transactional',
  'navigational',
]);

const FunnelStageEnum = z.enum(['awareness', 'consideration', 'decision']);

// ── Brief: los 5 campos históricos siguen obligatorios; la capa estratégica es
//    opcional-con-default para no romper briefs/flows existentes ──────────────

export const BlogBriefSchema = z.object({
  topic: z.string().min(5, 'El tema es muy corto').max(200),
  angle: z.string().min(10, 'Define el ángulo técnico específico').max(500),
  targetAudience: z.string().min(5).max(200),
  keyPoints: z.array(z.string().min(2).max(200)).min(2, 'Al menos 2 puntos clave').max(8),
  tone: z.enum(['técnico-directo', 'educativo', 'opinión-defendida', 'caso-práctico']),
  // Estrategia (WS2)
  userProblem: z.string().max(500).default(''),
  searchIntent: SearchIntentEnum.or(z.literal('')).default(''),
  primaryKeyword: z.string().max(120).default(''),
  secondaryKeywords: z.array(z.string().min(1).max(120)).max(10).default([]),
  entities: z.array(z.string().min(1).max(120)).max(15).default([]),
  contentPillar: z.string().max(120).default(''),
  funnelStage: FunnelStageEnum.or(z.literal('')).default(''),
  contentGoal: z.string().max(300).default(''),
  desiredAction: z.string().max(300).default(''),
  pixeltecExperience: z.array(z.string().min(1).max(500)).max(10).default([]),
  internalLinkTargets: z.array(BriefInternalLinkTargetSchema).max(10).default([]),
  sources: z.array(PostSourceSchema).max(20).default([]),
});
export type BlogBriefInput = z.infer<typeof BlogBriefSchema>;

export const BlogPostEditSchema = z.object({
  title: z.string().min(10).max(120),
  excerpt: z.string().min(50).max(160),
  body: z.string().min(500),
  category: z.enum(['arquitectura', 'automatización', 'case-study', 'opinión']),
  tags: z.array(z.string().min(1).max(50)).max(8),
  coverImage: z.string().url().nullable().optional(),
  seoMetaTitle: z.string().max(70).optional(),
  seoMetaDescription: z.string().max(160).optional(),
  // WS2 — SEO/editorial editable desde el editor
  coverImageAlt: z.string().max(200).optional(),
  canonicalUrl: z.string().url().nullable().optional(),
  noindex: z.boolean().optional(),
  primaryKeyword: z.string().max(120).optional(),
  secondaryKeywords: z.array(z.string().min(1).max(120)).max(10).optional(),
  searchIntent: SearchIntentEnum.or(z.literal('')).optional(),
  contentPillar: z.string().max(120).optional(),
  sources: z.array(PostSourceSchema).max(20).optional(),
  internalLinks: z.array(InternalLinkSchema).max(20).optional(),
  reviewerId: z.string().nullable().optional(),
  nextReviewAt: z.string().nullable().optional(),
  aiDisclosure: z.string().max(300).nullable().optional(),
  claimsVerified: z.boolean().optional(),
  sourcesVerified: z.boolean().optional(),
});
export type BlogPostEditInput = z.infer<typeof BlogPostEditSchema>;

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}
