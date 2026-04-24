import { z } from 'zod';

export const BlogBriefSchema = z.object({
  topic: z.string().min(5, 'El tema es muy corto').max(200),
  angle: z.string().min(10, 'Define el ángulo técnico específico').max(500),
  targetAudience: z.string().min(5).max(200),
  keyPoints: z.array(z.string().min(2).max(200)).min(2, 'Al menos 2 puntos clave').max(8),
  tone: z.enum(['técnico-directo', 'educativo', 'opinión-defendida', 'caso-práctico']),
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
});
export type BlogPostEditInput = z.infer<typeof BlogPostEditSchema>;

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}
