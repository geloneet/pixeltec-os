/**
 * Nombre de la cookie httpOnly usada como nonce CSRF en el flujo OAuth de Meta
 * (Facebook/Instagram). Compartida entre `src/app/api/auth/meta/route.ts`
 * (la emite) y `src/app/api/auth/meta/callback/route.ts` (la valida).
 *
 * Vive en su propio módulo porque Next.js no permite exportar constantes
 * arbitrarias desde un archivo `route.ts` — solo handlers HTTP y un puñado
 * de exports reservados (`dynamic`, `revalidate`, etc.).
 */
export const OAUTH_STATE_COOKIE = 'meta_oauth_state';
