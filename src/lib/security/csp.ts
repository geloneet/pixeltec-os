/**
 * CSP puro — la construcción de la Content-Security-Policy y los matchers de
 * ruta viven aquí, FUERA de `middleware.ts`, por dos razones:
 *
 *  1. `middleware.ts` importa `@/lib/auth/config`, que arrastra `@/lib/db`
 *     (abre el cliente Postgres al evaluarse el módulo). Testear la CSP no
 *     debe requerir DB ni env de NextAuth — este módulo es 100% puro y sin
 *     side-effects, así que `csp.test.ts` lo cubre en entorno `node` limpio.
 *  2. La CSP es una superficie de seguridad GLOBAL: aislarla como funciones
 *     puras y bien testeadas es más seguro que dejarla embebida en el handler.
 *
 * `middleware.ts` es un consumidor delgado: resuelve los flags por ruta con
 * los predicados de aquí y llama `buildCsp`.
 */

// Dominios de terceros con script-src propio (fuera del nonce): Cloudflare Web
// Analytics, inyectado a nivel de edge/proxy.
const THIRD_PARTY_SCRIPT_SRC = ['https://static.cloudflareinsights.com'].join(' ');

// ── Framing: quién puede embeber (frame-ancestors) y qué se puede embeber
//    (frame-src). Ambos por defecto en 'none' GLOBAL; se relajan puntualmente
//    por ruta con arrays/regex EXPLÍCITOS (nada genérico especulativo). ──────

/**
 * Rutas que se embeben a propósito en un <iframe> oculto del mismo origen
 * (técnica de "Imprimir": iframe + win.print()). `frame-ancestors 'none'`
 * bloquea CUALQUIER framing, incluso del mismo origen, así que rompía ese
 * botón en silencio al pasar la CSP de Report-Only a enforcing. Se relaja
 * puntualmente a `frame-ancestors 'self'` solo aquí — el resto del sitio se
 * mantiene en 'none'. NO se toca su `frame-src` (sigue 'none').
 */
export const SELF_FRAMEABLE_PATHS = ['/api/documents/proposal-pdf'] as const;

/**
 * Preview embebible de PixelForge (F6A): la landing renderizada que las
 * páginas admin embeben en un <iframe> same-origin. Debe declarar
 * `frame-ancestors 'self'` para dejarse embeber. Segmento dinámico `[id]`, por
 * eso es regex y no entrada de array. Coincide EXACTA con `.../<id>/preview`.
 */
export const PIXELFORGE_PREVIEW_RE = /^\/proyectos\/pixelforge\/[^/]+\/preview$/;

/**
 * Prefijo de las páginas admin que EMBEBEN el iframe de preview (p.ej.
 * `/proyectos/pixelforge/<id>/produccion`). Solo bajo este prefijo se relaja
 * `frame-src` de 'none' a 'self' (permitir cargar iframes del mismo origen).
 * NO afecta al CRM (`/clientes/*`) ni a `proposal-pdf` (`/api/documents/*`):
 * la CSP de la ruta de Imprimir queda intacta.
 */
export const SELF_FRAME_EMBEDDER_PATHS = ['/proyectos/pixelforge'] as const;

/** Match por igualdad exacta o por prefijo de segmento (`p` o `p/...`). */
function matchesExactOrPrefix(paths: readonly string[], pathname: string): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * ¿Esta ruta puede ser embebida en un iframe same-origin?
 * → `frame-ancestors 'self'` (si no, `'none'`).
 */
export function isSelfFrameable(pathname: string): boolean {
  return matchesExactOrPrefix(SELF_FRAMEABLE_PATHS, pathname) || PIXELFORGE_PREVIEW_RE.test(pathname);
}

/**
 * ¿Esta ruta EMBEBE iframes same-origin (es el "padre" del preview)?
 * → `frame-src 'self'` (si no, `'none'`).
 */
export function isSelfFrameEmbedder(pathname: string): boolean {
  return matchesExactOrPrefix(SELF_FRAME_EMBEDDER_PATHS, pathname);
}

export interface CspOptions {
  /** `frame-ancestors 'self'` — la ruta admite ser embebida same-origin. */
  allowSelfFraming: boolean;
  /** `frame-src 'self'` — la ruta admite cargar iframes same-origin. */
  allowSelfFrameChildren: boolean;
}

export function buildCsp(nonce: string, opts: CspOptions): string {
  const scriptSrc =
    process.env.NODE_ENV === 'development'
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' ${THIRD_PARTY_SCRIPT_SRC}`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${THIRD_PARTY_SCRIPT_SRC}`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    opts.allowSelfFrameChildren ? "frame-src 'self'" : "frame-src 'none'",
    opts.allowSelfFraming ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'report-uri /api/csp-report',
    'report-to csp-endpoint',
  ].join('; ');
}

/** Resuelve la CSP completa para una ruta — la única fuente de verdad por-ruta. */
export function cspForPath(nonce: string, pathname: string): string {
  return buildCsp(nonce, {
    allowSelfFraming: isSelfFrameable(pathname),
    allowSelfFrameChildren: isSelfFrameEmbedder(pathname),
  });
}
