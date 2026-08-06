import type { PublicationIssue } from '@/lib/blog/publication-gate';

/**
 * Deep-links del panel de publicación (B-PR4). Módulo PURO: mapea el
 * `anchor.field` de un issue del gate a la etapa del editor donde vive el
 * campo y al id del contenedor a resaltar (`<div id="anchor-…">` en las
 * etapas). Sin DOM, sin React — testeable en aislamiento.
 */

export type EditorStage = 'escribir' | 'optimizar' | 'verificar';

export interface AnchorTarget {
  stage: EditorStage;
  elementId?: string;
}

/** field del gate → etapa + elemento. Los campos de SEO comparten el ancla del
 *  panel SEO (un solo card en Optimizar); los de portada, el card de portada. */
export const FIELD_ANCHORS: Record<string, { stage: EditorStage; elementId: string }> = {
  title: { stage: 'escribir', elementId: 'anchor-title' },
  excerpt: { stage: 'escribir', elementId: 'anchor-excerpt' },
  body: { stage: 'escribir', elementId: 'anchor-body' },
  coverImage: { stage: 'escribir', elementId: 'anchor-cover' },
  tags: { stage: 'escribir', elementId: 'anchor-tags' },
  slug: { stage: 'optimizar', elementId: 'anchor-slug' },
  canonicalUrl: { stage: 'optimizar', elementId: 'anchor-seo' },
  'seo.metaTitle': { stage: 'optimizar', elementId: 'anchor-seo' },
  'seo.metaDescription': { stage: 'optimizar', elementId: 'anchor-seo' },
  'seo.primaryKeyword': { stage: 'optimizar', elementId: 'anchor-seo' },
  internalLinks: { stage: 'optimizar', elementId: 'anchor-internal-links' },
  sources: { stage: 'verificar', elementId: 'anchor-sources' },
  'editorial.reviewerId': { stage: 'verificar', elementId: 'anchor-editorial' },
};

/** Destino de navegación de un issue. Un issue sin anchor (o con un field
 *  desconocido) cae en la etapa Escribir sin elemento que resaltar. */
export function anchorTarget(issue: PublicationIssue): AnchorTarget {
  const field = issue.anchor?.field;
  if (field && FIELD_ANCHORS[field]) return FIELD_ANCHORS[field];
  return { stage: 'escribir' };
}
