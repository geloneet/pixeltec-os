/**
 * Catálogo de herramientas SEO del panel (WO-2026-00095) — paridad con
 * `src/lib/seo-tools.ts` de Muebles Encino.
 *
 * Cada herramienta guarda su contenido y su interruptor de publicación en
 * `app_settings`, y tiene un botón «Crear con IA».
 *
 * DOS DIFERENCIAS DELIBERADAS con Encino, decididas para este port:
 *
 *   1. **Prompts locales.** Encino pide el prompt maestro a la central
 *      (`api.pixeltec.mx/seo/master-prompt`) y cae al prompt local si no
 *      responde. En PixelTEC OS ese host está vetado por el `egress-guard`, así
 *      que aquí el prompt local ES la fuente — no un respaldo. Sin llamada de
 *      red extra y sin tocar la política de egress.
 *   2. **Anthropic, no Gemini.** Encino genera con `gemini-2.5-flash`.
 *      PixelTEC OS usa el cliente Anthropic ya existente, sin dependencias ni
 *      variables de entorno nuevas (coherente con D-C-bis, aprobada por Miguel).
 *
 * Alcance: un solo sitio, pixeltec.mx (decisión de Miguel, 2026-08-26).
 *
 * Módulo puro: sin `db`, sin `next`, sin `'use server'`.
 */

/** El sitio que administra este módulo. Un solo valor: no hay multi-sitio. */
export const SEO_SITE = {
  id: 'pixeltec',
  name: 'PixelTEC',
  url: 'https://pixeltec.mx',
} as const;

export const SEO_TOOL_KEYS = ['llms', 'robots', 'local-business', 'structured-data'] as const;
export type SeoToolKey = (typeof SEO_TOOL_KEYS)[number];

export interface SeoTool {
  key: SeoToolKey;
  title: string;
  /** Descripción corta bajo el título, en lenguaje de Miguel. */
  description: string;
  /** Formato de salida: texto plano o JSON. Decide el validador y el editor. */
  format: 'text' | 'json';
  /** Clave del contenido en `app_settings`. */
  settingKey: string;
  /** Clave del interruptor de publicación en `app_settings`. */
  enabledKey: string;
  /** Reglas de generación. Fuente, no respaldo — ver cabecera. */
  prompt: string;
}

export const SEO_TOOLS: Record<SeoToolKey, SeoTool> = {
  llms: {
    key: 'llms',
    title: 'llms.txt',
    description:
      'Guía para los modelos de IA (ChatGPT, Perplexity, Claude) sobre qué es este sitio y qué contenido priorizar.',
    format: 'text',
    settingKey: 'seo_llms_txt',
    enabledKey: 'seo_llms_enabled',
    prompt:
      'Eres experto en SEO para IA (GEO/AEO). Genera el contenido de un archivo llms.txt para el sitio indicado. Estructura recomendada: un encabezado con el nombre del negocio y una línea de resumen (qué hace, dónde), seguido de secciones en markdown con enlaces a las páginas más importantes (servicios, blog, contacto). Sé conciso y factual; no inventes datos ni URLs que no estén en el contexto. Devuelve SOLO el contenido del archivo, en texto plano/markdown.',
  },
  robots: {
    key: 'robots',
    title: 'robots.txt',
    description:
      'Reglas para los rastreadores de buscadores (qué pueden y qué no rastrear) y la ubicación del sitemap.',
    format: 'text',
    settingKey: 'seo_robots_txt',
    enabledKey: 'seo_robots_enabled',
    prompt:
      'Eres experto en SEO técnico. Genera un archivo robots.txt correcto para el sitio indicado. Permite el rastreo del contenido público, bloquea rutas de administración y de API privada, e incluye la línea Sitemap con la URL del sitemap del sitio. No bloquees CSS/JS. Devuelve SOLO el contenido del archivo robots.txt, en texto plano.',
  },
  'local-business': {
    key: 'local-business',
    title: 'Negocio local (LocalBusiness)',
    description:
      'Datos del negocio para Google (schema.org LocalBusiness): dirección, teléfono, horario. Alimenta el panel de conocimiento.',
    format: 'json',
    settingKey: 'seo_local_business',
    enabledKey: 'seo_local_business_enabled',
    prompt:
      'Eres experto en datos estructurados schema.org. Genera un objeto JSON-LD de tipo LocalBusiness (o el subtipo más apropiado) para el negocio indicado, usando SOLO los datos reales del contexto (nombre, dirección, teléfono, email, horario, URL, redes sociales como sameAs). No inventes coordenadas ni datos que no existan. Devuelve SOLO el JSON válido, sin la etiqueta <script>.',
  },
  'structured-data': {
    key: 'structured-data',
    title: 'Datos estructurados (schema.org)',
    description:
      'Entidades base del sitio (Organization, WebSite) para mejorar los resultados enriquecidos en Google.',
    format: 'json',
    settingKey: 'seo_structured_data',
    enabledKey: 'seo_structured_data_enabled',
    prompt:
      'Eres experto en datos estructurados schema.org. Genera un grafo JSON-LD (@graph) con las entidades base del sitio (Organization y WebSite, enlazadas por @id) usando SOLO los datos reales del contexto. No inventes datos. Devuelve SOLO el JSON válido, sin la etiqueta <script>.',
  },
};

export function getSeoTool(key: string): SeoTool | null {
  return (SEO_TOOLS as Record<string, SeoTool>)[key] ?? null;
}

export function isSeoToolKey(key: string): key is SeoToolKey {
  return (SEO_TOOL_KEYS as readonly string[]).includes(key);
}

/** Todas las claves de ajuste del módulo — útil para leerlas de un tirón. */
export function allSeoSettingKeys(): string[] {
  return Object.values(SEO_TOOLS).flatMap((t) => [t.settingKey, t.enabledKey]);
}

/**
 * Valida el contenido de una herramienta según su formato.
 * Devuelve `null` si es válido, o el mensaje de error si no.
 */
export function validateToolContent(tool: SeoTool, content: string): string | null {
  if (tool.format !== 'json') return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  try {
    JSON.parse(trimmed);
    return null;
  } catch {
    return 'El contenido debe ser JSON válido.';
  }
}
