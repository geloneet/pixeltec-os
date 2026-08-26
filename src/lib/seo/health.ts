/**
 * Salud SEO (WO-2026-00095) — paridad con `/seo/salud` de Muebles Encino.
 *
 * Función pura: recibe un retrato del estado y devuelve la lista de chequeos.
 * No consulta nada — así se puede testear sin base de datos y la página solo
 * se encarga de reunir los datos.
 */

export type HealthStatus = 'ok' | 'warn' | 'off';

export interface HealthCheck {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
  /** Ruta del panel donde se arregla. */
  href: string;
}

export interface SeoSnapshot {
  llms: { enabled: boolean; hasContent: boolean };
  robots: { enabled: boolean; hasContent: boolean };
  localBusiness: { enabled: boolean; hasContent: boolean };
  structuredData: { enabled: boolean; hasContent: boolean };
  sitemapEnabled: boolean;
  pageSchemaCount: number;
  socialCount: number;
  blog: { published: number; missingMetaDescription: number };
}

function toolCheck(
  id: string,
  label: string,
  href: string,
  state: { enabled: boolean; hasContent: boolean },
): HealthCheck {
  if (!state.hasContent) {
    return { id, label, status: 'off', detail: 'Sin contenido todavía.', href };
  }
  if (!state.enabled) {
    return { id, label, status: 'warn', detail: 'Tiene contenido pero no se está publicando.', href };
  }
  return { id, label, status: 'ok', detail: 'Publicado.', href };
}

export function buildHealthChecks(s: SeoSnapshot): HealthCheck[] {
  return [
    toolCheck('llms', 'llms.txt', '/seo/llms', s.llms),
    toolCheck('robots', 'robots.txt', '/seo/robots', s.robots),
    toolCheck('local-business', 'Negocio local', '/seo/local-business', s.localBusiness),
    toolCheck('structured-data', 'Datos estructurados', '/seo/structured-data', s.structuredData),
    {
      id: 'sitemap',
      label: 'Sitemap XML',
      status: s.sitemapEnabled ? 'ok' : 'warn',
      detail: s.sitemapEnabled
        ? 'Incluye todas las páginas publicadas.'
        : 'Reducido: solo se está publicando la página de inicio.',
      href: '/seo/sitemap',
    },
    {
      id: 'page-schema',
      label: 'Schema por página',
      status: s.pageSchemaCount > 0 ? 'ok' : 'off',
      detail:
        s.pageSchemaCount > 0
          ? `${s.pageSchemaCount} ${s.pageSchemaCount === 1 ? 'página tiene' : 'páginas tienen'} tipos asignados.`
          : 'Ninguna página tiene tipos asignados.',
      href: '/seo/schema',
    },
    {
      id: 'social',
      label: 'Redes sociales',
      status: s.socialCount > 0 ? 'ok' : 'off',
      detail:
        s.socialCount > 0
          ? `${s.socialCount} ${s.socialCount === 1 ? 'enlace activo' : 'enlaces activos'}.`
          : 'Sin enlaces activos: los datos del negocio salen sin «sameAs».',
      href: '/seo/redes',
    },
    {
      id: 'blog-meta',
      label: 'Resúmenes del blog',
      status: s.blog.published === 0 ? 'off' : s.blog.missingMetaDescription > 0 ? 'warn' : 'ok',
      detail:
        s.blog.published === 0
          ? 'Todavía no hay entradas publicadas.'
          : s.blog.missingMetaDescription > 0
            ? `${s.blog.missingMetaDescription} de ${s.blog.published} entradas no tienen resumen para Google.`
            : `Las ${s.blog.published} entradas publicadas tienen resumen.`,
      href: '/blog-cms',
    },
  ];
}

/** Resumen para el encabezado: cuántos chequeos están en cada estado. */
export function summarizeHealth(checks: HealthCheck[]): Record<HealthStatus, number> {
  return checks.reduce(
    (acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }),
    { ok: 0, warn: 0, off: 0 } as Record<HealthStatus, number>,
  );
}
