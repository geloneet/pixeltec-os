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

/** Enlace interno curado que SÍ se publica: solo destino y anchor. El
 *  propósito editorial (`placement`) y el flag `verified` no cruzan. */
export interface PublicInternalLink {
  targetUrl: string;
  anchor: string;
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
  // ── WO-2026-00088 (paridad Encino): FAQ, etiquetas y Maps SÍ se renderizan
  //    en la página ⇒ son públicos por definición. ──────────────────────────
  faq: { question: string; answer: string }[];
  tags: string[];
  /** URL de Google Maps embed ya validada por el servidor, o null. */
  mapsEmbed: string | null;
  /** Enlazado interno editorial (estrategia de backlinks 2026-08-05): SOLO
   *  enlaces `verified` con destino interno (path relativo o pixeltec.mx,
   *  normalizado a relativo). Evolución deliberada de la frontera P1-A: un
   *  enlace que se renderiza en la página es público por definición — lo que
   *  sigue sin cruzar es el metadato editorial (placement, verified). */
  internalLinks: PublicInternalLink[];
}

const INTERNAL_ORIGIN = 'https://pixeltec.mx';

/** Normaliza un destino interno a path relativo; null si el destino no es
 *  interno (los externos NO pertenecen al bloque de enlazado interno). */
function toInternalPath(targetUrl: string): string | null {
  const url = targetUrl.trim();
  if (url.startsWith('/')) return url;
  if (url === INTERNAL_ORIGIN) return '/';
  if (url.startsWith(`${INTERNAL_ORIGIN}/`)) return url.slice(INTERNAL_ORIGIN.length);
  return null;
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
    faq: post.faq
      .filter((f) => f.question.trim().length > 0 && f.answer.trim().length > 0)
      .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })),
    tags: post.tags.filter((t) => t.trim().length > 0),
    mapsEmbed: post.mapsEmbed,
    sources: post.sources
      .filter((s) => s.verifiedByHuman)
      .map((s) => ({
        title: s.title,
        url: s.url,
        publisher: s.publisher,
        accessedAt: s.accessedAt,
      })),
    internalLinks: post.internalLinks
      .filter((l) => l.verified && l.anchor.trim().length > 0)
      .flatMap((l) => {
        const path = toInternalPath(l.targetUrl);
        return path ? [{ targetUrl: path, anchor: l.anchor.trim() }] : [];
      }),
  };
}
