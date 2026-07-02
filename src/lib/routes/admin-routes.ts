/**
 * Single source of truth for all admin/protected routes.
 *
 * To add a new admin route:
 *   1. Add the slug to ADMIN_ROUTES below.
 *   2. Add '/<slug>/:path*' (and optionally '/<slug>') to config.matcher
 *      in src/middleware.ts — Next.js requires a static literal array there,
 *      so it cannot be derived dynamically at build time.
 *
 * Everything else (PROTECTED_PATHS, KNOWN_ROUTES) is derived automatically.
 */
export const ADMIN_ROUTES = [
  'hoy',
  'tareas',
  'proyectos',
  'clientes',
  'whatsapp',
  'cobros',
  'accesos',
  'vps',
  'portal',
  'crypto-intel',
  'perfil',
  'notificaciones',
  'blog-admin',
  'crecimiento',
  'documentos',
  'ia-factory',
] as const;

export type AdminRoute = typeof ADMIN_ROUTES[number];

/** Paths that require a valid session cookie. Used by middleware at request time. */
export const PROTECTED_PATHS = ADMIN_ROUTES.map(r => `/${r}`);

/** Known single-segment paths that are NOT client portal slugs. */
export const KNOWN_ROUTES = new Set<string>([
  ...ADMIN_ROUTES,
  // Public site routes
  'about', 'contact', 'services', 'blog', 'metodologia', 'equipo',
  'industrias', 'privacy-policy', 'aviso-de-privacidad', 'terminos-de-servicio',
  'data-deletion', 'guias-transformacion', 'login', 'api',
  // Public proposal pages
  'p',
]);
