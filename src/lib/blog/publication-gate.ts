import {
  EMPTY_EDITORIAL,
  EMPTY_SEO,
  type BlogPostDoc,
  type PostEditorial,
  type PostInternalLink,
  type PostSource,
} from './types';

/**
 * Gate de publicación (WS2 — P0-2). Función PURA: sin DB, sin sesión, sin
 * fechas propias — recibe el post y devuelve un veredicto. `publishPost` la
 * ejecuta EN SERVIDOR (el botón de la UI era el único gate y cualquier llamada
 * directa a la action publicaba un draft sin validar nada).
 *
 * Filosofía (prompt maestro §7.7): bloquea lo que rompe indexación, confianza
 * o integridad; advierte lo demás. Sin métricas artificiales: ni densidad de
 * keywords, ni conteos de palabras obligatorios, ni FAQ forzada.
 */

export interface PublicationIssue {
  code: string;
  message: string;
}

export interface PublicationVerdict {
  ready: boolean;
  blockers: PublicationIssue[];
  warnings: PublicationIssue[];
}

/** Subconjunto del post que el gate evalúa (shape serializado o de fila con
 *  merge de defaults — el caller garantiza objetos completos). */
export interface PublicationCandidate {
  status: string;
  title: string;
  excerpt: string;
  body: string;
  slug: string;
  coverImage: string | null;
  author: { name: string; uid: string };
  seo: BlogPostDoc['seo'];
  editorial: PostEditorial;
  sources: PostSource[];
  internalLinks: PostInternalLink[];
  ai: { model: string; editedByHuman: boolean };
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Estados desde los que se permite publicar: el flujo normal exige pasar por
 *  aprobación; `published` se admite para re-publicación idempotente. */
const PUBLISHABLE_FROM = new Set(['approved', 'published']);

const EXTERNAL_PLACEHOLDER_RE = /placehold\.co|placeholder\.com|via\.placeholder/i;

/** Cuentas genéricas: firmar "Admin" rompe E-E-A-T — el autor debe ser persona real. */
const GENERIC_AUTHOR_RE = /^(?:admin|administrador)$/i;

/** CTA que promete sesión/llamada: el diagnóstico real es un cuestionario de
 *  ~3 minutos — prometer "30 minutos" o una llamada crea expectativa falsa. */
const CTA_PROMISE_RE = /(?:agenda|reserva|agendar|reservar)[^.\n]{0,60}(?:sesi[oó]n|llamada|reuni[oó]n|30\s*min)/i;

/** Claims sobre plataformas de terceros: precios y políticas cambian — piden
 *  respaldo oficial (docs de producto cuentan como oficial). */
const PLATFORM_CLAIM_RE = /whatsapp|instagram|facebook|messenger/i;
const OFFICIAL_SOURCE_TYPES = new Set(['official', 'regulation', 'technical-documentation']);

export function normalizeCandidate(row: {
  status: string;
  title: string;
  excerpt: string;
  body: string;
  slug: string;
  coverImage: string | null;
  author: unknown;
  seo: unknown;
  editorial: unknown;
  sources: unknown;
  internalLinks: unknown;
  ai: unknown;
}): PublicationCandidate {
  const ai = (row.ai ?? {}) as Record<string, unknown>;
  return {
    status: row.status,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    slug: row.slug ?? '',
    coverImage: row.coverImage,
    author: (row.author ?? { name: '', uid: '' }) as PublicationCandidate['author'],
    seo: { ...EMPTY_SEO, ...((row.seo ?? {}) as Partial<BlogPostDoc['seo']>) },
    editorial: { ...EMPTY_EDITORIAL, ...((row.editorial ?? {}) as Partial<PostEditorial>) },
    sources: (row.sources ?? []) as PostSource[],
    internalLinks: (row.internalLinks ?? []) as PostInternalLink[],
    ai: {
      model: (ai.model as string) ?? '',
      editedByHuman: (ai.editedByHuman as boolean) ?? false,
    },
  };
}

export function validatePostForPublication(post: PublicationCandidate): PublicationVerdict {
  const blockers: PublicationIssue[] = [];
  const warnings: PublicationIssue[] = [];

  // ── Blockers ───────────────────────────────────────────────────────────────
  if (!PUBLISHABLE_FROM.has(post.status)) {
    blockers.push({
      code: 'status',
      message: `Solo se publica desde "approved" (estado actual: "${post.status}") — pasa por revisión primero.`,
    });
  }
  if (!post.title || post.title.trim().length < 10) {
    blockers.push({ code: 'title', message: 'Título ausente o menor a 10 caracteres.' });
  }
  if (!post.excerpt || post.excerpt.trim().length < 50) {
    blockers.push({ code: 'excerpt', message: 'Extracto ausente o menor a 50 caracteres (alimenta la metadescripción).' });
  }
  if (!post.body || post.body.trim().length < 500) {
    blockers.push({ code: 'body', message: 'Cuerpo ausente o demasiado corto para publicarse.' });
  }
  if (!post.slug || !SLUG_RE.test(post.slug)) {
    blockers.push({ code: 'slug', message: `Slug inválido ("${post.slug}") — minúsculas, números y guiones.` });
  }
  if (!post.author?.name?.trim() || !post.author?.uid?.trim()) {
    blockers.push({ code: 'author', message: 'El post no tiene autor real (nombre y usuario) — "Admin" anónimo no es publicable.' });
  } else if (GENERIC_AUTHOR_RE.test(post.author.name.trim())) {
    blockers.push({ code: 'author-generic', message: `El autor "${post.author.name}" es una cuenta genérica — publica con la firma de una persona real.` });
  }
  if (/^#\s/.test(post.body.trimStart())) {
    blockers.push({ code: 'body-h1', message: 'El cuerpo empieza con un encabezado nivel 1 ("# ") — duplicaría el H1 de la plantilla; elimínalo o conviértelo en "##".' });
  }
  if (post.coverImage && EXTERNAL_PLACEHOLDER_RE.test(post.coverImage)) {
    blockers.push({ code: 'cover', message: 'La portada es un placeholder externo — usa una imagen real o déjala vacía (fallback local).' });
  }
  if (post.seo.canonicalUrl && !/^https?:\/\//.test(post.seo.canonicalUrl)) {
    blockers.push({ code: 'canonical', message: 'La canonical declarada no es una URL absoluta.' });
  }
  const unverifiedSources = post.sources.filter((s) => !s.verifiedByHuman);
  if (unverifiedSources.length > 0) {
    blockers.push({
      code: 'sources',
      message: `${unverifiedSources.length} fuente(s) sin verificación humana — verifica o elimina antes de publicar.`,
    });
  }
  // Solo aplica a contenido generado por IA (ai.model presente): un post
  // escrito a mano no exige el flag de edición.
  if (post.ai.model && !post.ai.editedByHuman && !post.editorial.reviewedAt) {
    blockers.push({
      code: 'human-review',
      message: 'Borrador generado por IA sin edición ni revisión humana registrada.',
    });
  }

  // ── Warnings (no bloquean) ─────────────────────────────────────────────────
  if (!post.seo.metaTitle) warnings.push({ code: 'meta-title', message: 'Sin metatítulo propio: se usará el título del post.' });
  if (!post.seo.metaDescription) warnings.push({ code: 'meta-description', message: 'Sin metadescripción propia: se usará el extracto.' });
  if (post.title.length > 70) warnings.push({ code: 'title-length', message: 'Título mayor a 70 caracteres: Google lo truncará en resultados.' });
  if (!post.coverImage) warnings.push({ code: 'cover-generic', message: 'Sin portada: se usará la imagen OG genérica del sitio.' });
  if (post.coverImage && !post.seo.ogImageAlt) warnings.push({ code: 'cover-alt', message: 'La portada no tiene alt descriptivo (se usará el título).' });
  if (post.internalLinks.length === 0) warnings.push({ code: 'internal-links', message: 'Sin enlaces internos declarados hacia servicios o artículos relacionados.' });
  const unverifiedLinks = post.internalLinks.filter((l) => !l.verified);
  if (unverifiedLinks.length > 0) warnings.push({ code: 'links-unverified', message: `${unverifiedLinks.length} enlace(s) interno(s) sin verificar.` });
  if (!post.editorial.reviewerId) warnings.push({ code: 'reviewer', message: 'Sin revisor asignado.' });
  // Solo cuando el noindex es una realidad vigente (post ya publicado con la
  // bandera puesta a propósito): en borradores es el default de seguridad y
  // publishPost lo apaga solo — advertirlo ahí era puro ruido.
  if (post.seo.noindex && post.status === 'published') warnings.push({ code: 'noindex', message: 'El post está publicado con noindex: visible en el sitio pero excluido de buscadores.' });
  if (!post.seo.primaryKeyword) warnings.push({ code: 'keyword', message: 'Sin palabra clave principal declarada (no bloquea, pero la estrategia queda sin registro).' });
  if (/\d+(?:[.,]\d+)?\s*%/.test(post.body) && post.sources.length === 0) {
    warnings.push({ code: 'stats-no-source', message: 'El cuerpo cita porcentajes pero el post no tiene ninguna fuente — respalda las cifras o quítalas.' });
  }
  if (CTA_PROMISE_RE.test(post.body)) {
    warnings.push({ code: 'cta-promise', message: 'El cuerpo invita a agendar una sesión/llamada (p. ej. "30 minutos"): el diagnóstico real es un cuestionario de ~3 minutos — ajusta el CTA.' });
  }
  if (PLATFORM_CLAIM_RE.test(post.body) && !post.sources.some((s) => OFFICIAL_SOURCE_TYPES.has(s.sourceType ?? ''))) {
    warnings.push({ code: 'platform-no-official-source', message: 'El artículo habla de plataformas de terceros (WhatsApp/Meta) sin ninguna fuente oficial, regulatoria o de documentación — precios y políticas cambian; cita la fuente oficial.' });
  }

  return { ready: blockers.length === 0, blockers, warnings };
}
