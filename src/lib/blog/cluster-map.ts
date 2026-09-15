/**
 * Mapa de clusters del blog → recursos de PixelTEC (WO-2026-00345, L3).
 *
 * Problema (auditoría 2026-09-14): de 5 artículos publicados, uno no enlaza a
 * nada y ninguno enlaza a las landings ni a /industrias; todos sesgan a
 * /pixelbot y /services/automatizacion. `internalLinks` es un DATO del CMS,
 * así que cuando el editor no lo carga, el bloque «Recursos de PixelTEC
 * mencionados» se rellena desde aquí según la categoría y las etiquetas.
 *
 * Módulo puro y LITERAL a propósito: lo importa un Client Component, así que
 * no puede arrastrar los registros de landings (cientos de KB de contenido).
 * `cluster-map.test.ts` comprueba contra esos registros que cada href existe.
 *
 * Categorías = `BlogCategory` real (`./types.ts`): arquitectura,
 * automatización, case-study, opinión. Nada inventado.
 */
import type { BlogCategory } from './types';

export interface RelatedResource {
  href: string;
  anchor: string;
}

export const RELATED_RESOURCES_BY_CATEGORY: Record<BlogCategory, readonly RelatedResource[]> = {
  automatización: [
    { href: '/services/automatizacion', anchor: 'Automatización de procesos con IA' },
    { href: '/automatiza-tu-negocio', anchor: 'Guía: automatiza tu negocio por áreas' },
    { href: '/automatizacion-puerto-vallarta', anchor: 'Automatización con IA en Puerto Vallarta' },
  ],
  arquitectura: [
    { href: '/services/ecosistemas-web', anchor: 'Desarrollo web y apps a la medida' },
    { href: '/software-a-medida-para-empresas', anchor: 'Software a la medida para empresas' },
    { href: '/sistemas-a-medida', anchor: 'Sistemas a la medida: cuándo conviene' },
  ],
  'case-study': [
    { href: '/industrias', anchor: 'Industrias donde ya construimos' },
    { href: '/services/ecosistemas-web', anchor: 'Desarrollo web y apps a la medida' },
    { href: '/diagnostico', anchor: 'Diagnóstico gratuito de madurez digital' },
  ],
  opinión: [
    { href: '/services/consultoria', anchor: 'Consultoría tecnológica para pymes' },
    { href: '/pixelbot', anchor: 'WhatsAgent: agente de IA para WhatsApp' },
    { href: '/diagnostico', anchor: 'Diagnóstico gratuito de madurez digital' },
  ],
};

/** Categoría desconocida o vacía: los hubs, sin adivinar el cluster. */
export const DEFAULT_RELATED_RESOURCES: readonly RelatedResource[] = [
  { href: '/services', anchor: 'Servicios de PixelTEC' },
  { href: '/industrias', anchor: 'Industrias donde ya construimos' },
];

/** Etiquetas que delatan un artículo de WhatsApp aunque su categoría sea otra. */
const WHATSAPP_RESOURCES: readonly RelatedResource[] = [
  { href: '/pixelbot', anchor: 'WhatsAgent: agente de IA para WhatsApp' },
  { href: '/automatizar-whatsapp-business', anchor: 'Automatizar WhatsApp Business: app vs. API' },
];

const MAX_RESOURCES = 3;

function isCategory(value: string): value is BlogCategory {
  return Object.prototype.hasOwnProperty.call(RELATED_RESOURCES_BY_CATEGORY, value);
}

/**
 * Recursos sugeridos para un artículo: los de su categoría (o el default),
 * con los de WhatsApp al frente si las etiquetas lo indican, sin repetir lo
 * que el post ya enlaza en `internalLinks`, tope 3.
 */
export function relatedResourcesFor(
  category: string,
  tags: readonly string[],
  existingInternalLinks: readonly { targetUrl: string }[],
): RelatedResource[] {
  const base = isCategory(category) ? RELATED_RESOURCES_BY_CATEGORY[category] : DEFAULT_RELATED_RESOURCES;
  const mentionsWhatsApp = tags.some((t) => /whats\s?app/i.test(t));
  const candidates = mentionsWhatsApp ? [...WHATSAPP_RESOURCES, ...base] : [...base];

  const taken = new Set(existingInternalLinks.map((l) => l.targetUrl.replace(/\/+$/, '') || '/'));
  const out: RelatedResource[] = [];
  for (const r of candidates) {
    if (taken.has(r.href)) continue;
    taken.add(r.href);
    out.push(r);
    if (out.length === MAX_RESOURCES) break;
  }
  return out;
}
