/**
 * Composición del robots.txt (WO-2026-00095).
 *
 * Módulo puro — sin `db`, sin `next` — para poder testear la garantía que lo
 * hace distinto de Encino: un robots.txt publicado desde el panel NUNCA puede
 * romper las reglas mínimas del sitio.
 *
 * PRV-02 / SEO-04 (WO-2026-00268) — CAMBIO DE POLÍTICA DELIBERADO:
 *
 *  1. `BASE_DISALLOW` ya NO enumera las rutas del panel. Publicarlas en un
 *     archivo que cualquiera puede leer equivale a entregar el mapa del
 *     backoffice, y un `Disallow` tampoco cumplía su propósito: impide
 *     RASTREAR, no INDEXAR — una URL descubierta por un enlace externo podía
 *     acabar en el índice igual, sin snippet. La garantía real de no
 *     indexación vive ahora en la cabecera `X-Robots-Tag: noindex, nofollow`
 *     que `src/middleware.ts` pone en `NOINDEX_PATHS`, más el `robots` de los
 *     layouts de /login, /portal y /reset-password. Aquí queda `/api/`, que sí
 *     tiene sentido no rastrear (endpoints, no páginas).
 *
 *  2. Las reglas que falten en un archivo publicado se insertan DENTRO del
 *     primer grupo `User-agent:`, no al final. Antes se añadían después de la
 *     línea `Sitemap:`, y una directiva suelta fuera de todo grupo la ignoran
 *     los rastreadores: la protección existía en el texto pero no surtía
 *     efecto.
 */
import { SITE } from '@/lib/site-config';

export const BASE_DISALLOW = ['/api/'];

const SITEMAP_LINE = `Sitemap: ${SITE.url}/sitemap.xml`;

/** El robots.txt que Pixeltec.mx sirve cuando no hay ninguno publicado. */
export function derivedRobots(): string {
  return ['User-agent: *', 'Allow: /', ...BASE_DISALLOW.map((p) => `Disallow: ${p}`), '', SITEMAP_LINE, ''].join('\n');
}

/**
 * Índice de la línea donde hay que insertar reglas para que caigan dentro del
 * primer grupo `User-agent:`, es decir, justo después de su última directiva.
 * Devuelve `null` si el archivo publicado no declara ningún grupo.
 */
function endOfFirstGroup(lower: string[]): number | null {
  const start = lower.findIndex((l) => l.startsWith('user-agent:'));
  if (start === -1) return null;
  let end = start + 1;
  // El grupo termina en la primera línea que no es una directiva suya: una
  // línea en blanco, otro `User-agent:` (grupo nuevo) o `Sitemap:`, que es
  // global y por convención va fuera de los grupos.
  while (
    end < lower.length &&
    lower[end] !== '' &&
    !lower[end].startsWith('user-agent:') &&
    !lower[end].startsWith('sitemap:')
  ) {
    end++;
  }
  return end;
}

/** Añade al archivo publicado lo que le falte: reglas base y sitemap. */
export function reconcileRobots(published: string): string {
  const lines = published.trimEnd().split('\n');
  const lower = lines.map((l) => l.trim().toLowerCase());
  const missing = BASE_DISALLOW.filter((p) => !lower.includes(`disallow: ${p.toLowerCase()}`));
  const hasSitemap = lower.some((l) => l.startsWith('sitemap:'));

  let out = [...lines];
  if (missing.length > 0) {
    const insertAt = endOfFirstGroup(lower);
    const block = ['# Añadido por Pixeltec.mx.', ...missing.map((p) => `Disallow: ${p}`)];
    if (insertAt === null) {
      // Sin ningún grupo declarado, las directivas sueltas no aplicarían a
      // nadie: se abre uno.
      out = [...out, '', 'User-agent: *', ...block];
    } else {
      out = [...out.slice(0, insertAt), ...block, ...out.slice(insertAt)];
    }
  }
  if (!hasSitemap) out = [...out, '', SITEMAP_LINE];

  return [...out, ''].join('\n');
}
