import type { BlogAiParams } from '@/lib/blog/types';

/** Tonos del wizard IA (paridad Encino `src/lib/blog-ai-params.ts`). */
export const AI_ARTICLE_TONES = [
  'informativo',
  'educativo',
  'profesional',
  'conversacional',
  'persuasivo',
  'inspirador',
] as const;

export type AiArticleTone = (typeof AI_ARTICLE_TONES)[number];

export type AiArticleParams = Omit<BlogAiParams, 'tone'> & { tone: AiArticleTone };

export function isAiArticleTone(value: string): value is AiArticleTone {
  return (AI_ARTICLE_TONES as readonly string[]).includes(value);
}

/** Un tono desconocido cae a «informativo» en vez de castear a ciegas. */
export function toAiArticleParams(params: BlogAiParams | null): AiArticleParams | null {
  if (!params) return null;
  return { ...params, tone: isAiArticleTone(params.tone) ? params.tone : 'informativo' };
}
