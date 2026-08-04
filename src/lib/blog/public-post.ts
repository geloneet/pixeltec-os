import type { BlogPostSerialized } from './types';

/**
 * Frontera de datos del blog público (P1-A, gate de Miguel 2026-08-04).
 *
 * El Client Component del artículo recibía `BlogPostSerialized` COMPLETO y
 * React lo serializaba íntegro al navegador: brief interno (estrategia SEO,
 * experiencia declarada), metadatos editoriales (reviewer, flags de
 * verificación) y trazabilidad de IA viajaban en el RSC payload de cada
 * artículo. Este módulo define el CONTRATO PÚBLICO y el único mapper
 * autorizado para cruzar hacia el cliente.
 *
 * Regla dura: el DTO se construye con OBJETO LITERAL (allowlist). Nada de
 * spread del registro, nada de Omit<> cosmético — lo que no se nombra aquí,
 * no existe en el navegador.
 */

export interface PublicSource {
  title: string;
  url: string;
  publisher: string;
  accessedAt: string;
}

export interface PublicBlogPost {
  slug: string;
  title: string;
  body: string;
  category: string;
  coverImage: string | null;
  /** Alt de la portada (seo.ogImageAlt); vacío ⇒ la vista usa el título. */
  coverAlt: string;
  publishedAt: string | null;
  /** Fecha de última revisión editorial visible ("Actualizado el…"). */
  lastReviewedAt: string | null;
  readingTimeMin: number;
  authorName: string;
  /** SOLO fuentes verificadas por humano, y de cada una SOLO lo visible. */
  sources: PublicSource[];
}

export function toPublicBlogPost(post: BlogPostSerialized): PublicBlogPost {
  return {
    slug: post.slug,
    title: post.title,
    body: post.body,
    category: post.category,
    coverImage: post.coverImage,
    coverAlt: post.seo.ogImageAlt ?? '',
    publishedAt: post.publishedAt,
    lastReviewedAt: post.editorial.lastReviewedAt,
    readingTimeMin: post.readingTimeMin,
    authorName: post.author.name,
    sources: post.sources
      .filter((s) => s.verifiedByHuman)
      .map((s) => ({
        title: s.title,
        url: s.url,
        publisher: s.publisher,
        accessedAt: s.accessedAt,
      })),
  };
}
