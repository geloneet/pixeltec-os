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

// ── Framing: quién puede embeber (frame-ancestors) — por defecto 'none'
//    GLOBAL, se relaja puntualmente por ruta con arrays/regex EXPLÍCITOS
//    (nada genérico especulativo). `frame-src` (qué puede embeber ESTE
//    documento) es GLOBAL e incondicional — ver comentario junto a su
//    directiva en `buildCsp` sobre por qué no puede ser per-ruta en una SPA. ──

/**
 * Rutas que se embeben a propósito en un <iframe> oculto del mismo origen
 * (técnica de "Imprimir": iframe + win.print()). `frame-ancestors 'none'`
 * bloquea CUALQUIER framing, incluso del mismo origen, así que rompía ese
 * botón en silencio al pasar la CSP de Report-Only a enforcing. Se relaja
 * puntualmente a `frame-ancestors 'self'` solo aquí — el resto del sitio se
 * mantiene en 'none'.
 */
export const SELF_FRAMEABLE_PATHS = ['/api/documents/proposal-pdf'] as const;

/**
 * Preview embebible de PixelForge (F6A): la landing renderizada que las
 * páginas admin embeben en un <iframe> same-origin. Debe declarar
 * `frame-ancestors 'self'` para dejarse embeber. Segmento dinámico `[id]`, por
 * eso es regex y no entrada de array. Coincide EXACTA con `.../<id>/preview`.
 */
export const PIXELFORGE_PREVIEW_RE = /^\/proyectos\/pixelforge\/[^/]+\/preview$/;

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

export interface CspOptions {
  /** `frame-ancestors 'self'` — la ruta admite ser embebida same-origin. */
  allowSelfFraming: boolean;
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
    // EXCEPCIÓN DE IMPLEMENTACIÓN (aprobada por Miguel, gate F6A 2026-07-17):
    // el plan maestro pedía relajar `frame-src` solo bajo /proyectos/pixelforge,
    // pero eso es inviable en una SPA (razones abajo). La superficie de ataque
    // NO se amplía: `frame-ancestors` por-respuesta sigue siendo el gate real y
    // solo el preview embebido de PixelForge (y proposal-pdf) aceptan framing.
    //
    // `frame-src 'self'` es GLOBAL e incondicional (no por-ruta) — la CSP es
    // per-DOCUMENT, y en App Router la navegación cliente (soft nav) NO
    // recarga el documento ni recalcula sus headers: un usuario que cargó
    // por primera vez fuera de `/proyectos/pixelforge` y navega ahí por
    // client-side routing seguiría arrastrando el `frame-src 'none'` de la
    // ruta original, y el <iframe> del PreviewFrame en /produccion se
    // rechazaría en silencio. Parametrizar `frame-src` por ruta es por tanto
    // insano en una SPA — el gate real de seguridad no es "quién puede
    // EMBEBER un iframe" sino "qué se puede FRAMEAR", y eso lo sigue
    // decidiendo `frame-ancestors` por-respuesta (abajo, parametrico): solo
    // el preview de PixelForge (regex) y `proposal-pdf` (Imprimir) declaran
    // `frame-ancestors 'self'`, todo lo demás sigue en 'none'. Permitir
    // `frame-src 'self'` en todas partes solo habilita el INTENTO de cargar
    // un iframe same-origin; no amplía qué documentos aceptan ser embebidos.
    // Bonus: esto también arregla el caso preexistente de "Imprimir" en
    // /clientes/*, que embebe un iframe oculto same-origin para win.print()
    // y que un `frame-src 'none'` global habría bloqueado igual de en silencio.
    "frame-src 'self'",
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
  });
}
