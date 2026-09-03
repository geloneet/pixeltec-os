/**
 * Registro de landings por keyword (WO-2026-00189).
 *
 * Complementa —no sustituye— a `local-services.ts` y `automatizacion-local.ts`:
 * aquellas son páginas de SERVICIO × CIUDAD; estas son páginas de KEYWORD
 * (intención de búsqueda concreta) con dos variantes por keyword, la genérica
 * (nacional) y la de Puerto Vallarta.
 *
 * Reglas duras del registro (plan
 * `docs/seo/plan-posicionamiento-puerto-vallarta-2026-09.md` §4):
 *
 * 1. La variante Puerto Vallarta NUNCA es la genérica con el nombre de la
 *    ciudad cambiado. Google trata las near-duplicate location pages como
 *    doorway pages. Por eso `city` obliga a `localContext` propio, y la FAQ,
 *    los casos de uso y los ejemplos de la variante local son distintos.
 * 2. Cero datos inventados: sin precios, sin clientes que no existan, sin
 *    cifras sin fuente. Los ejemplos se redactan como escenarios, no como
 *    casos "reales" no verificables.
 * 3. Los claims sobre WhatsApp/Meta se limitan a lo verificable en su
 *    documentación pública (ventana de servicio de 24 h, plantillas
 *    aprobadas, WhatsApp Business Platform, coexistencia app + API).
 * 4. `externalSources`: SOLO dominios `.gob.mx` y `.org.mx`, verificados con
 *    `curl -sIL` (200) antes de entrar aquí. Nunca Wikipedia (regla vigente
 *    desde Muebles Encino, 2026-08-17).
 * 5. `metaTitle` ≤ 60 y `metaDescription` ≤ 155 caracteres; 5 preguntas en
 *    `faq` con el mismo texto que emite el FAQPage JSON-LD.
 *
 * El test `keyword-landings.test.ts` verifica mecánicamente 1, 4 y 5.
 */

import { KEYWORD_LANDINGS_SOFTWARE } from './keyword-landings-software';
import { KEYWORD_LANDINGS_WHATSAPP } from './keyword-landings-whatsapp';
import { KEYWORD_LANDINGS_APPS } from './keyword-landings-apps';

/**
 * Iconos permitidos en `useCases`. Amplía el union del patrón existente
 * (`local-services.ts`) con nombres válidos de `lucide-react` — el componente
 * `keyword-landing-page.tsx` mapea este union a los componentes reales, así
 * que agregar un nombre aquí obliga a registrarlo allá (error de tipo si no).
 */
export type KeywordLandingIcon =
  | 'MessageSquareText'
  | 'FileScan'
  | 'BarChart3'
  | 'MailCheck'
  | 'Factory'
  | 'Building2'
  | 'Bot'
  | 'Workflow'
  | 'Clock'
  | 'Users'
  | 'ShoppingCart'
  | 'CalendarCheck'
  | 'Send'
  | 'Sparkles'
  | 'Code2'
  | 'Smartphone'
  | 'Globe'
  | 'LayoutDashboard'
  | 'Boxes'
  | 'ClipboardList'
  | 'Headset'
  | 'HeartPulse'
  | 'UtensilsCrossed'
  | 'BedDouble'
  | 'PlaneTakeoff'
  | 'Repeat'
  | 'CreditCard'
  | 'Store'
  | 'Timer'
  | 'TrendingUp'
  | 'ShieldCheck'
  | 'Search'
  | 'Database'
  | 'Layers'
  | 'AppWindow'
  | 'Wrench'
  | 'Rocket'
  | 'FileText'
  | 'Megaphone'
  | 'Route'
  | 'Cpu'
  | 'Tablet'
  | 'MapPin'
  | 'Handshake'
  | 'Ticket';

/** Hub temático al que cuelga la landing (breadcrumb y enlazado interno). */
export type KeywordLandingHub = 'ecosistemas-web' | 'automatizacion';

export interface KeywordLandingSection {
  title: string;
  body: string[];
  /** H3 dentro del H2 de la sección. Nunca UI en el outline. */
  bullets?: { title: string; description: string }[];
}

export interface KeywordLandingUseCase {
  icon: KeywordLandingIcon;
  title: string;
  description: string;
}

export interface KeywordLandingFaqItem {
  q: string;
  a: string;
}

export interface KeywordLandingSource {
  label: string;
  /** Solo `.gob.mx` o `.org.mx`, verificada 200 con curl. */
  href: string;
}

export interface KeywordLandingCity {
  name: 'Puerto Vallarta';
  region: 'Jalisco';
}

export interface KeywordLanding {
  /** kebab-case; es la ruta: `/<slug>`. */
  slug: string;
  /** Keyword objetivo tal cual se busca (sin capitalizar). */
  keyword: string;
  /** Único H1 de la página. */
  h1: string;
  /** ≤ 60 caracteres, con la keyword. */
  metaTitle: string;
  /** ≤ 155 caracteres, con la keyword. */
  metaDescription: string;
  /** Párrafo inmediatamente debajo del H1: qué es y para quién. */
  intro: string;
  /** 2–4 secciones H2. */
  sections: KeywordLandingSection[];
  useCases: KeywordLandingUseCase[];
  /** 5 preguntas; texto idéntico al FAQPage JSON-LD. */
  faq: KeywordLandingFaqItem[];
  /** 2 fuentes de autoridad pública mexicana. */
  externalSources: KeywordLandingSource[];
  /** Slugs de otras landings del registro (variante + clúster). */
  relatedSlugs: string[];
  hub: KeywordLandingHub;
  /** Presente solo en las variantes locales; obliga a `localContext`. */
  city?: KeywordLandingCity;
  /** Contexto local propio (obligatorio si hay `city`). */
  localContext?: { title: string; body: string[] };
  ctaHref: '/contact' | '/diagnostico';
  /** Se inserta en «¿Listo para {ctaVerb}?». */
  ctaVerb: string;
}

/** Metadatos del hub: alimentan el breadcrumb y el back-link del componente. */
export const KEYWORD_LANDING_HUBS: Record<KeywordLandingHub, { href: string; label: string }> = {
  'ecosistemas-web': { href: '/services/ecosistemas-web', label: 'Ecosistemas Web Avanzados' },
  'automatizacion': { href: '/services/automatizacion', label: 'Automatización de Procesos con IA' },
};

export const KEYWORD_LANDINGS: KeywordLanding[] = [
  ...KEYWORD_LANDINGS_SOFTWARE,
  ...KEYWORD_LANDINGS_WHATSAPP,
  ...KEYWORD_LANDINGS_APPS,
];

export function getKeywordLanding(slug: string): KeywordLanding | undefined {
  return KEYWORD_LANDINGS.find((landing) => landing.slug === slug);
}

/**
 * Landings relacionadas de una landing dada, en el orden declarado en
 * `relatedSlugs`. Los slugs que no existan se descartan en silencio (el test
 * del registro es el que falla si alguien deja un slug muerto).
 */
export function getRelatedLandings(slug: string): KeywordLanding[] {
  const landing = getKeywordLanding(slug);
  if (!landing) return [];
  return landing.relatedSlugs
    .map((related) => getKeywordLanding(related))
    .filter((related): related is KeywordLanding => Boolean(related));
}

/** Landings agrupadas por hub — usado por `/services/[slug]` para enlazarlas. */
export const KEYWORD_LANDINGS_BY_HUB: Record<KeywordLandingHub, KeywordLanding[]> = {
  'ecosistemas-web': KEYWORD_LANDINGS.filter((landing) => landing.hub === 'ecosistemas-web'),
  'automatizacion': KEYWORD_LANDINGS.filter((landing) => landing.hub === 'automatizacion'),
};
