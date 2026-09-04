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
  /**
   * De qué trata la página, en una frase. Copiada de la `description` real de
   * su metadata (`buildMetadata` en su `page.tsx` o `layout.tsx`) — no es texto
   * decorativo: es lo único que la IA lee para proponer tipos de schema, así
   * que tiene que describir la página de verdad.
   */
  description: string;
}

/**
 * Páginas públicas de pixeltec.mx a las que se puede asignar schema.
 * Espejo de las rutas estáticas del sitemap; el Blog tiene su propio selector
 * por entrada (pestaña «Snippets» del editor), así que aquí va solo el índice.
 */
export const SITE_PAGES: SitePage[] = [
  {
    path: '/',
    label: 'Inicio',
    description:
      'Portada de PixelTEC: transformamos procesos complejos en ecosistemas web y automatizaciones escalables para empresas que buscan rentabilidad y control absoluto.',
  },
  {
    path: '/services',
    label: 'Servicios',
    description:
      'Catálogo de los tres servicios de la agencia: ecosistemas web avanzados, automatización de procesos y consultoría tecnológica, cada uno con su propia subpágina.',
  },
  {
    path: '/pixelbot',
    label: 'PixelBot',
    description:
      'Landing de WhatsAgent, el agente de IA para WhatsApp que atiende, califica y transfiere conversaciones al equipo del cliente. Producto con planes y precios desde $490 MXN/mes.',
  },
  {
    path: '/blog',
    label: 'Blog (índice)',
    description:
      'Índice del blog: listado de guías, comparativas, calculadoras y casos reales sobre automatización con IA, software a medida y desarrollo de aplicaciones en México.',
  },
  {
    path: '/industrias',
    label: 'Industrias',
    description:
      'Listado de los sectores que atiende PixelTEC (logística, clínicas, retail, hotelería, SaaS) con los problemas concretos que resuelve en cada vertical.',
  },
  {
    path: '/diagnostico',
    label: 'Diagnóstico',
    description:
      'Cuestionario interactivo: el visitante responde unas preguntas y recibe una recomendación personalizada con su nivel de madurez digital y los servicios sugeridos.',
  },
  {
    path: '/about',
    label: 'Nosotros',
    description:
      'Página institucional sobre quiénes somos: el equipo de PixelTEC, su metodología y los tres pilares de trabajo (desarrollo, automatización e IA, consultoría).',
  },
  {
    path: '/equipo',
    label: 'Equipo',
    description:
      'Perfiles de las personas que forman PixelTEC, con su rol, herramientas y enlaces profesionales.',
  },
  {
    path: '/contact',
    label: 'Contacto',
    description:
      'Formulario de contacto y datos de la oficina de Puerto Vallarta (teléfono, WhatsApp, correo) para agendar un diagnóstico con el equipo.',
  },
  {
    path: '/metodologia',
    label: 'Metodología',
    description:
      'Explicación del proceso de trabajo en cuatro fases: diagnóstico y arquitectura, desarrollo ágil, despliegue e integración, y evolución continua.',
  },
  {
    path: '/guias-transformacion',
    label: 'Guías de transformación',
    description:
      'Centro de recursos descargables: playbooks, arquitecturas y estrategias para escalar el ecosistema digital de una empresa.',
  },
];

/** Busca una página del catálogo por su ruta (ya normalizada o no). */
export function getSitePage(path: string): SitePage | undefined {
  const norm = normalizeSchemaPath(path);
  return SITE_PAGES.find((p) => p.path === norm);
}

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
