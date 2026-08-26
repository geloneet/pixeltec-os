/**
 * Catálogo de tipos de rich snippet por entrada (WO-2026-00088 FASE 11).
 *
 * Paridad con Muebles Encino (`src/lib/seo-schema.ts`): mismo catálogo y misma
 * semántica de saneado. La diferencia es DÓNDE se guarda: Encino los persiste
 * en un ajuste global del SEO Control Center (`seo_page_schema`, mapa ruta →
 * tipos); PixelTEC OS no tiene ese módulo, así que viven en `blog_posts.seo`
 * (jsonb) como campo aditivo — mismo precedente que `coverAttribution` y
 * `nofollow`, sin migración.
 *
 * Módulo puro: sin `db`, sin `next`, sin `'use server'` — testeable en aislado.
 */

/** Tipos ofrecidos en el selector. El valor vacío es el placeholder de Encino. */
export const BLOG_SCHEMA_TYPES: { value: string; label: string }[] = [
  { value: '', label: '— Sin schema —' },
  // — Galería de Google (resultados enriquecidos) —
  { value: 'Article', label: 'Artículo' },
  { value: 'BreadcrumbList', label: 'Ruta de exploración' },
  { value: 'ItemList', label: 'Carrusel' },
  { value: 'Course', label: 'Lista de cursos' },
  { value: 'Dataset', label: 'Conjunto de datos' },
  { value: 'DiscussionForumPosting', label: 'Foro de debate' },
  { value: 'Quiz', label: 'Preguntas y respuestas educativas' },
  { value: 'EmployerAggregateRating', label: 'Puntuación total de la empresa' },
  { value: 'Event', label: 'Evento' },
  { value: 'ImageObject', label: 'Metadatos de imágenes' },
  { value: 'JobPosting', label: 'Oferta de empleo' },
  { value: 'LocalBusiness', label: 'Empresa local' },
  { value: 'MathSolver', label: 'Solucionador de problemas matemáticos' },
  { value: 'Movie', label: 'Película' },
  { value: 'Organization', label: 'Organización' },
  { value: 'Product', label: 'Producto' },
  { value: 'ProfilePage', label: 'Página de perfil' },
  { value: 'QAPage', label: 'Preguntas y respuestas' },
  { value: 'Recipe', label: 'Receta' },
  { value: 'Review', label: 'Fragmento de reseña' },
  { value: 'SoftwareApplication', label: 'Aplicación de software' },
  { value: 'SpeakableSpecification', label: 'Lectura en voz alta' },
  { value: 'CreativeWork', label: 'Suscripción y contenido con muro de pago' },
  { value: 'VacationRental', label: 'Alquiler vacacional' },
  { value: 'VideoObject', label: 'Vídeo' },
  // — Tipos generales schema.org (sin resultado enriquecido en la galería) —
  { value: 'Service', label: 'Service (general)' },
  { value: 'WebPage', label: 'Web Page (general)' },
  { value: 'Person', label: 'Person (general)' },
  { value: 'Book', label: 'Book (general)' },
];

/**
 * Tipos que la entrada ya emite SIEMPRE en automático y que por eso NO se
 * ofrecen como «adicionales»: los inyecta `src/app/blog/[slug]/page.tsx`.
 * `BlogPosting` es la especialización de `Article` que emite el artículo.
 */
export const BLOG_AUTOMATIC_SCHEMA_TYPES = ['Article', 'BlogPosting', 'BreadcrumbList', 'FAQPage'] as const;

const SCHEMA_VALUES = new Set(BLOG_SCHEMA_TYPES.map((t) => t.value).filter(Boolean));

/** ¿Es un tipo del catálogo (excluido el placeholder vacío)? */
export function isBlogSchemaType(value: string): boolean {
  return SCHEMA_VALUES.has(value);
}

/** Tipos seleccionables como «adicionales» (fuera del catálogo automático). */
export function selectableBlogSchemaTypes(): { value: string; label: string }[] {
  return BLOG_SCHEMA_TYPES.filter(
    (t) => t.value !== '' && !(BLOG_AUTOMATIC_SCHEMA_TYPES as readonly string[]).includes(t.value),
  );
}

/**
 * Sanea lo que venga del cliente o del jsonb: acepta string legado o lista,
 * descarta vacíos, desconocidos y duplicados, y recorta a 10 tipos.
 * Espejo de `sanitizeSchemaTypes` de Encino más el tope explícito.
 */
export function sanitizeBlogSchemaTypes(value: unknown): string[] {
  const list = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(list)) return [];
  return Array.from(new Set(list.filter((t): t is string => typeof t === 'string')))
    .filter((t) => isBlogSchemaType(t))
    .slice(0, 10);
}

/**
 * Nodo JSON-LD mínimo por tipo adicional, igual que el `SchemaInjector` de
 * Encino (`@context`, `@type`, `name`, `url`) — pero resuelto en el servidor,
 * no inyectado en el cliente.
 */
export function buildExtraSchemaNodes(
  types: readonly string[],
  post: { title: string; url: string },
): { '@context': string; '@type': string; name: string; url: string }[] {
  return sanitizeBlogSchemaTypes([...types]).map((type) => ({
    '@context': 'https://schema.org',
    '@type': type,
    name: post.title,
    url: post.url,
  }));
}
