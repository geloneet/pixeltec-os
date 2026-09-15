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
      'Portada de PixelTEC: desarrollo web y apps, software a la medida y automatización con IA y WhatsApp para pymes y empresas de Puerto Vallarta, Bahía de Banderas, Guadalajara y todo México; enlaza a las landings por ciudad y por keyword.',
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
      'Hub de los sectores con clientes reales de PixelTEC (clínicas dentales, hoteles, logística, distribución de agua, comercio y energía solar): qué se construyó en cada uno y enlaces a las páginas de industria con caso propio.',
  },
  {
    path: '/industrias/clinicas-dentales',
    label: 'Software para clínicas dentales',
    description:
      'Página de industria: plataforma a la medida para clínicas dentales (agenda de citas, expediente clínico, comprobantes, recordatorios, roles) con el caso real de Smile More en Guadalajara.',
  },
  {
    path: '/industrias/hoteles',
    label: 'Sistema de reservas y CRM para hoteles',
    description:
      'Página de industria: motor de reservas propio y CRM hotelero a la medida, sitio bilingüe y SEO local del hotel, con el caso real de Villa Nogal en San Sebastián del Oeste, Jalisco.',
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

/**
 * Tipos schema.org que el CÓDIGO ya emite con datos reales, por ruta
 * (L1, WO-2026-00345). El esqueleto del panel para esos tipos sería un nodo
 * vacío `{@type, name: label, url}` compitiendo con el real — p. ej. un
 * `LocalBusiness` llamado «Contacto» en /contact frente a `#organization`, o
 * un `ItemList` «Industrias» vacío junto al ItemList real del hub.
 *
 * `*` aplica a todas las rutas: son las entidades del layout raíz
 * (`OrganizationStructuredData`) y la entidad local, que solo existe una.
 * Se filtra en la EMISIÓN (`schemaNodesForPath`); `serializePageSchemaMap`
 * no cambia, así Miguel sigue viendo en `/seo/schema` lo que guardó.
 */
export const CODE_OWNED_PAGE_TYPES: Record<string, readonly string[]> = {
  '*': ['Organization', 'WebSite', 'LocalBusiness', 'ProfessionalService'],
  '/': ['ItemList', 'Service'],
  '/industrias': ['ItemList', 'BreadcrumbList', 'Service'],
  '/industrias/clinicas-dentales': ['BreadcrumbList', 'Service', 'FAQPage'],
  '/industrias/hoteles': ['BreadcrumbList', 'Service', 'FAQPage'],
  '/blog': ['CollectionPage', 'BreadcrumbList', 'ItemList'],
  '/about': ['BreadcrumbList'],
  '/contact': ['BreadcrumbList'],
  '/equipo': ['BreadcrumbList', 'ProfilePage', 'ItemList'],
  '/pixelbot': ['BreadcrumbList', 'Service', 'FAQPage'],
};

/** ¿Este tipo ya lo emite el código en esta ruta (o en todas)? */
export function isCodeOwnedType(pathname: string, type: string): boolean {
  const path = normalizeSchemaPath(pathname);
  return CODE_OWNED_PAGE_TYPES['*'].includes(type) || (CODE_OWNED_PAGE_TYPES[path] ?? []).includes(type);
}

/** Nodos JSON-LD mínimos para una ruta, listos para renderizar en el servidor.
 *  Omite los tipos que el código ya posee en esa ruta (`CODE_OWNED_PAGE_TYPES`). */
export function schemaNodesForPath(
  map: PageSchemaMap,
  pathname: string,
  page: { title: string; url: string },
): { '@context': string; '@type': string; name: string; url: string }[] {
  const path = normalizeSchemaPath(pathname);
  return (map[path] ?? [])
    .filter((type) => !isCodeOwnedType(path, type))
    .map((type) => ({
      '@context': 'https://schema.org',
      '@type': type,
      name: page.title,
      url: page.url,
    }));
}
