/**
 * Enlaces de la portada hacia las landings SEO (WO-2026-00343).
 *
 * No hay lista de URLs escrita a mano: los 12 enlaces ciudad×servicio se
 * derivan de los mismos registros que alimentan el sitemap y los chips de
 * `/services/[slug]`. Lo único declarado aquí es QUÉ landings por keyword se
 * destacan (6, genéricas) — el test comprueba que existen y que no son
 * variantes «-puerto-vallarta»: esa intención local ya la cubren las de ciudad
 * y duplicarla sería un patrón de doorway.
 */
import { LOCAL_AUTOMATION_CITIES } from './automatizacion-local';
import { CONSULTORIA_CITIES, DESARROLLO_WEB_CITIES } from './local-services';
import { getKeywordLanding } from './keyword-landings';

export interface HomeLandingLink {
  href: string;
  label: string;
}

export interface HomeLandingGroup {
  id: 'ecosistemas-web' | 'automatizacion' | 'consultoria';
  title: string;
  links: HomeLandingLink[];
}

/**
 * Orden de cobertura decidido por Miguel (2026-09-14): sede, área
 * metropolitana vecina, Jalisco interior. Las ciudades que no estén aquí
 * conservan el orden del registro, detrás de las nombradas.
 */
export const HOME_CITY_ORDER: readonly string[] = ['Puerto Vallarta', 'Bahía de Banderas', 'Guadalajara', 'Zapopan'];

/** Landings por keyword destacadas en la portada (2 por clúster, solo genéricas). */
export const HOME_FEATURED_KEYWORD_SLUGS = [
  'software-a-medida-para-empresas',
  'empresas-de-desarrollo-de-software',
  'automatizar-whatsapp-business',
  'automatizacion-de-mensajes-en-whatsapp',
  'desarrollo-de-app',
  'desarrollo-de-aplicaciones-moviles',
] as const;

const GROUPS: {
  id: HomeLandingGroup['id'];
  title: string;
  anchorPrefix: string;
  cities: { slug: string; city: string }[];
}[] = [
  { id: 'ecosistemas-web', title: 'Desarrollo web', anchorPrefix: 'Desarrollo web', cities: DESARROLLO_WEB_CITIES },
  { id: 'automatizacion', title: 'Automatización con IA', anchorPrefix: 'Automatización', cities: LOCAL_AUTOMATION_CITIES },
  { id: 'consultoria', title: 'Consultoría TI', anchorPrefix: 'Consultoría TI', cities: CONSULTORIA_CITIES },
];

function orderCities<T extends { city: string }>(cities: T[]): T[] {
  const rank = new Map(HOME_CITY_ORDER.map((c, i) => [c, i]));
  return [...cities].sort((a, b) => (rank.get(a.city) ?? 99) - (rank.get(b.city) ?? 99));
}

export function getHomeLandingGroups(): HomeLandingGroup[] {
  return GROUPS.map((g) => ({
    id: g.id,
    title: g.title,
    links: orderCities(g.cities).map((c) => ({ href: `/${c.slug}`, label: `${g.anchorPrefix} en ${c.city}` })),
  }));
}

export function getHomeGuideLinks(): HomeLandingLink[] {
  return HOME_FEATURED_KEYWORD_SLUGS.flatMap((slug) => {
    const landing = getKeywordLanding(slug);
    if (!landing) return [];
    return [{ href: `/${landing.slug}`, label: landing.keyword.charAt(0).toUpperCase() + landing.keyword.slice(1) }];
  });
}
