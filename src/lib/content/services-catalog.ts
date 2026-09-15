/**
 * Catálogo mínimo de los tres servicios (WO-2026-00343).
 *
 * Fuente única para el JSON-LD del home. `/services/[slug]/page.tsx` mantiene
 * hoy su propia metadata local; migrarla aquí es un seguimiento, no parte de
 * este WO (ese archivo está fuera de alcance).
 */
import { LOCAL_AUTOMATION_CITIES } from './automatizacion-local';
import { CONSULTORIA_CITIES, DESARROLLO_WEB_CITIES } from './local-services';

export type CatalogServiceSlug = 'ecosistemas-web' | 'automatizacion' | 'consultoria';

export interface ServiceCatalogEntry {
  slug: CatalogServiceSlug;
  name: string;
  /** `serviceType` de schema.org: cómo lo buscaría un cliente. */
  serviceType: string;
  description: string;
}

export const SERVICES_CATALOG: readonly ServiceCatalogEntry[] = [
  {
    slug: 'ecosistemas-web',
    name: 'Desarrollo Web y Apps',
    serviceType: 'Desarrollo web y aplicaciones a la medida',
    description:
      'Sitios corporativos, portales, CRMs y apps a la medida con Next.js y React para empresas que necesitan tecnología propia, no plantillas.',
  },
  {
    slug: 'automatizacion',
    name: 'Automatización con IA',
    serviceType: 'Automatización de procesos con inteligencia artificial y WhatsApp',
    description:
      'Bots de WhatsApp, scripts e IA aplicada que eliminan tareas repetitivas y conectan los sistemas que ya usa tu empresa.',
  },
  {
    slug: 'consultoria',
    name: 'Consultoría y Soporte TI',
    serviceType: 'Consultoría tecnológica para pymes y empresas',
    description:
      'Diagnóstico, plan de modernización, rediseño UI/UX y acompañamiento continuo para que la tecnología sirva a la operación.',
  },
] as const;

/** Ciudades con landing propia, deduplicadas, en el orden de cobertura de PixelTEC. */
export const SERVED_CITY_NAMES: readonly string[] = (() => {
  const registered = new Set(
    [...LOCAL_AUTOMATION_CITIES, ...DESARROLLO_WEB_CITIES, ...CONSULTORIA_CITIES].map((c) => c.city),
  );
  // Orden decidido por Miguel (2026-09-14): sede primero, luego el área
  // metropolitana vecina y al final Jalisco interior.
  const preferred = ['Puerto Vallarta', 'Bahía de Banderas', 'Guadalajara', 'Zapopan'];
  return [...preferred.filter((c) => registered.has(c)), ...[...registered].filter((c) => !preferred.includes(c))];
})();
