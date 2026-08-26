/**
 * Composición del robots.txt (WO-2026-00095).
 *
 * Módulo puro — sin `db`, sin `next` — para poder testear la garantía que lo
 * hace distinto de Encino: un robots.txt publicado desde el panel NUNCA puede
 * dejar las rutas privadas de la aplicación abiertas al rastreo. Las rutas
 * salen de `ADMIN_ROUTES`, la misma fuente que usa el middleware.
 */
import { PROTECTED_PATHS } from '@/lib/routes/admin-routes';
import { SITE } from '@/lib/site-config';

export const BASE_DISALLOW = [...PROTECTED_PATHS, '/login', '/portal', '/reset-password', '/api/'];

const SITEMAP_LINE = `Sitemap: ${SITE.url}/sitemap.xml`;

/** El robots.txt que PixelTEC OS sirve cuando no hay ninguno publicado. */
export function derivedRobots(): string {
  return ['User-agent: *', 'Allow: /', ...BASE_DISALLOW.map((p) => `Disallow: ${p}`), '', SITEMAP_LINE, ''].join('\n');
}

/** Añade al archivo publicado lo que le falte: rutas privadas y sitemap. */
export function reconcileRobots(published: string): string {
  const lines = published.trimEnd().split('\n');
  const lower = lines.map((l) => l.trim().toLowerCase());
  const missing = BASE_DISALLOW.filter((p) => !lower.includes(`disallow: ${p.toLowerCase()}`));
  const hasSitemap = lower.some((l) => l.startsWith('sitemap:'));

  const extra: string[] = [];
  if (missing.length > 0) {
    extra.push('', '# Añadido por PixelTEC OS: rutas privadas de la aplicación.', ...missing.map((p) => `Disallow: ${p}`));
  }
  if (!hasSitemap) extra.push('', SITEMAP_LINE);

  return [...lines, ...extra, ''].join('\n');
}
