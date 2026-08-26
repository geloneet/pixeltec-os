/**
 * Schema por página (WO-2026-00095) — paridad con `/seo/schema` de Muebles
 * Encino: un mapa `ruta → tipos schema.org[]` guardado en `app_settings`.
 *
 * Reutiliza el catálogo del Blog (`@/lib/blog-cms/schema-types`, FASE 11 de
 * WO-2026-00088) en vez de duplicarlo: es el mismo catálogo de Encino y la
 * misma semántica de saneado. Aquí solo se añade el mapa por ruta.
 *
 * Módulo puro: sin `db`, sin `next`.
 */
import { sanitizeBlogSchemaTypes } from '@/lib/blog-cms/schema-types';

export const SETTING_PAGE_SCHEMA = 'seo_page_schema';

export type PageSchemaMap = Record<string, string[]>;

export interface SitePage {
  /** Ruta pública, sin slash final (como las sirve PixelTEC OS). */
  path: string;
  label: string;
}

/**
 * Páginas públicas de pixeltec.mx a las que se puede asignar schema.
 * Espejo de las rutas estáticas del sitemap; el Blog tiene su propio selector
 * por entrada (pestaña «Snippets» del editor), así que aquí va solo el índice.
 */
export const SITE_PAGES: SitePage[] = [
  { path: '/', label: 'Inicio' },
  { path: '/services', label: 'Servicios' },
  { path: '/pixelbot', label: 'PixelBot' },
  { path: '/blog', label: 'Blog (índice)' },
  { path: '/industrias', label: 'Industrias' },
  { path: '/diagnostico', label: 'Diagnóstico' },
  { path: '/about', label: 'Nosotros' },
  { path: '/equipo', label: 'Equipo' },
  { path: '/contact', label: 'Contacto' },
  { path: '/metodologia', label: 'Metodología' },
  { path: '/guias-transformacion', label: 'Guías de transformación' },
];

/** Normaliza una ruta a la forma canónica del mapa (sin slash final, salvo «/»). */
export function normalizeSchemaPath(pathname: string): string {
  const clean = pathname.split('?')[0].split('#')[0];
  if (clean === '' || clean === '/') return '/';
  return clean.replace(/\/+$/, '') || '/';
}

/**
 * Lee el mapa guardado. Acepta el formato de un solo tipo por ruta («Tipo») y
 * el de lista (`["Tipo", …]`); las rutas sin tipos válidos se omiten.
 */
export function parsePageSchemaMap(raw: string | null | undefined): PageSchemaMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: PageSchemaMap = {};
    for (const [path, value] of Object.entries(parsed as Record<string, unknown>)) {
      const types = sanitizeBlogSchemaTypes(value);
      if (types.length > 0) out[normalizeSchemaPath(path)] = types;
    }
    return out;
  } catch {
    return {};
  }
}

/** Serializa el mapa para guardarlo, descartando rutas desconocidas y vacías. */
export function serializePageSchemaMap(map: PageSchemaMap): string {
  const known = new Set(SITE_PAGES.map((p) => p.path));
  const out: PageSchemaMap = {};
  for (const [path, types] of Object.entries(map)) {
    const norm = normalizeSchemaPath(path);
    if (!known.has(norm)) continue;
    const clean = sanitizeBlogSchemaTypes(types);
    if (clean.length > 0) out[norm] = clean;
  }
  return JSON.stringify(out);
}

/** Nodos JSON-LD mínimos para una ruta, listos para renderizar en el servidor. */
export function schemaNodesForPath(
  map: PageSchemaMap,
  pathname: string,
  page: { title: string; url: string },
): { '@context': string; '@type': string; name: string; url: string }[] {
  return (map[normalizeSchemaPath(pathname)] ?? []).map((type) => ({
    '@context': 'https://schema.org',
    '@type': type,
    name: page.title,
    url: page.url,
  }));
}
