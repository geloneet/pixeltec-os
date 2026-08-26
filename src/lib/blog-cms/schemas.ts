import { z } from 'zod';
import { AI_ARTICLE_TONES } from './ai-params';

/**
 * Validación en frontera del Blog (WO-2026-00088), espejo del `saveSchema` de
 * Encino (`src/app/actions/blog.ts:46-73`) adaptado al modelo de PixelTEC OS:
 * el cuerpo es MARKDOWN (`body`), no HTML; la «meta description» alimenta
 * `excerpt` + `seo.metaDescription`; el alt de portada vive en
 * `seo.ogImageAlt`.
 */
export const BLOG_CMS_INTENTS = ['autosave', 'draft', 'publish', 'schedule'] as const;
export type BlogCmsIntent = (typeof BLOG_CMS_INTENTS)[number];

export const FaqItemSchema = z.object({
  question: z.string().max(300),
  answer: z.string().max(2000),
});

export const SaveBlogCmsPostSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(300),
  body: z.string().max(500_000, 'El contenido es demasiado largo'),
  metaDescription: z.string().max(160),
  seoTitle: z.string().max(70).optional(),
  noindex: z.boolean().optional(),
  nofollow: z.boolean().optional(),
  slug: z.string().max(120),
  category: z.string().max(80).nullable(),
  newCategory: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  faq: z.array(FaqItemSchema).max(20).optional(),
  coverImage: z.string().max(500).nullable(),
  coverImageAlt: z.string().max(200).optional(),
  mapsEmbed: z.string().max(2000).optional(),
  schemaTypes: z.array(z.string().max(60)).max(10).optional(),
  intent: z.enum(BLOG_CMS_INTENTS),
  scheduledAt: z.string().max(40).optional(),
});
export type SaveBlogCmsPostInput = z.infer<typeof SaveBlogCmsPostSchema>;

export const CategoryNameSchema = z.string().trim().min(1, 'Nombre requerido').max(80);

export const CreateCategorySchema = z.object({
  name: CategoryNameSchema,
  slug: z.string().max(120).optional(),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).optional(),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const GenerateArticleSchema = z.object({
  postId: z.string().uuid(),
  brief: z.string().min(10).max(10_000),
  tone: z.enum(AI_ARTICLE_TONES),
  audience: z.string().min(3).max(300),
  internalLinkCount: z.number().int().min(0).max(8),
  externalLinkCount: z.number().int().min(0).max(8),
  modification: z.string().min(3).max(2000).optional(),
  currentTitle: z.string().max(300).optional(),
  currentBody: z.string().max(200_000).optional(),
});
export type GenerateArticleInput = z.infer<typeof GenerateArticleSchema>;

export const GenerateFaqSchema = z.object({
  postId: z.string().uuid(),
  count: z.number().int().min(1).max(8),
  title: z.string().max(300),
  body: z.string().max(200_000),
  existingQuestions: z.array(z.string().max(300)).max(20).default([]),
});
export type GenerateFaqInput = z.infer<typeof GenerateFaqSchema>;

/** Resultado que el wizard devuelve al editor (NO se persiste solo). */
export const AiArticleResultSchema = z.object({
  title: z.string().min(3),
  metaDescription: z.string(),
  tags: z.array(z.string()).default([]),
  body: z.string().min(100),
});
export type AiArticleResult = z.infer<typeof AiArticleResultSchema>;

export const AiFaqResultSchema = z.object({
  faq: z.array(FaqItemSchema).min(1),
});
