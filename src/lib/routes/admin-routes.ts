/**
 * Single source of truth for all admin/protected routes.
 *
 * To add a new admin route:
 *   1. Add the slug to ADMIN_ROUTES below.
 *   2. Add '/<slug>/:path*' (and optionally '/<slug>') to config.matcher
 *      in src/middleware.ts — Next.js requires a static literal array there,
 *      so it cannot be derived dynamically at build time.
 *
 * PROTECTED_PATHS is derived automatically.
 */
export const ADMIN_ROUTES = [
  'hoy',
  // WO-2026-00132: sustituye Proyectos/Definición/PixelForge — «Trabajo».
  'proyectos',
  'clientes',
  'whatsapp',
  'cobros',
  'cotizaciones',
  'perfil',
  'notificaciones',
  // WO-2026-00088: Blog nuevo (paridad Encino). /blog sigue siendo público.
  'blog-cms',
  'seo',
  'usuarios',
  'smilemore-respuestas',
] as const;

export type AdminRoute = typeof ADMIN_ROUTES[number];

/** Paths that require a valid session cookie. Used by middleware at request time. */
export const PROTECTED_PATHS = ADMIN_ROUTES.map(r => `/${r}`);

/**
 * Rutas que nunca deben aparecer en un buscador (PRV-02, WO-2026-00268).
 *
 * Es el panel más las pantallas de acceso y el portal de clientes. Antes esta
 * lista se enumeraba en robots.txt, que es público: le entregaba a cualquiera
 * el mapa completo del backoffice, y además un `Disallow` no impide indexar
 * una URL que se descubra por otro camino (un enlace externo), sólo impide
 * rastrearla. Ahora el middleware manda `X-Robots-Tag: noindex, nofollow` en
 * estas rutas, que sí es una instrucción de NO indexar, y robots.txt deja de
 * publicar el inventario.
 *
 * `/invitacion` se suma a la lista histórica: es un enlace con token que no
 * tenía ni `Disallow` ni meta robots.
 */
export const NOINDEX_PATHS = [
  ...PROTECTED_PATHS,
  '/login',
  '/portal',
  '/reset-password',
  '/invitacion',
];

/** ¿La ruta pedida cae dentro de `NOINDEX_PATHS` (ella misma o un subpath)? */
export function isNoindexPath(pathname: string): boolean {
  return NOINDEX_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
