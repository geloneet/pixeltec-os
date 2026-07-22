/**
 * Allowlist de egress del qa-runner (PF-F8 T6, req. 14 del plan maestro) —
 * el runner SOLO puede navegar/pedir recursos del origin de
 * `QA_INTERNAL_APP_URL`. Módulo puro (sin Playwright): decide, no ejecuta —
 * `index.ts` cablea la decisión a `page.route("**\/*", …)`.
 *
 * Excepción única: imágenes `https:` de cualquier origin se PERMITEN (se
 * registran; si fallan alimentan QA-TE-003 como "externo" — minor). Todo lo
 * demás fuera del origin (scripts, estilos, fetch/XHR, fuentes, iframes,
 * websockets, navegación — incluida una navegación resultante de un
 * REDIRECT fuera de origin, que Playwright reintenta como una request nueva
 * y por tanto pasa OTRA VEZ por este mismo gate) se ABORTA sin excepción.
 * Cero excepción de bypass: ni por método, ni por `resourceType`, ni por
 * query string — la decisión depende ÚNICAMENTE de origin + (resourceType +
 * protocolo https) para imágenes.
 */

export type RequestDecision =
  | { allow: true; reason: "same-origin" | "external-image" }
  | { allow: false; reason: "blocked-external" | "invalid-url" };

/** Origin exacto (`protocol//host:port`) — SIN normalizar subdominios: `sub.origin.com` !== `origin.com`. */
export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Decide si una request del navegador puede salir. `resourceType` es el de
 * Playwright (`request.resourceType()`: "document" | "image" | "script" |
 * "stylesheet" | "xhr" | "fetch" | "font" | "websocket" | ...). Una URL que
 * no parsea (`invalid-url`) nunca se permite — nunca se interpreta un origin
 * ausente como "coincide".
 */
export function decideRequest(
  url: string,
  resourceType: string,
  allowedOrigin: string
): RequestDecision {
  const origin = originOf(url);
  if (origin === null) return { allow: false, reason: "invalid-url" };

  if (origin === allowedOrigin) return { allow: true, reason: "same-origin" };

  const isHttpsImage = resourceType === "image" && url.startsWith("https://");
  if (isHttpsImage) return { allow: true, reason: "external-image" };

  return { allow: false, reason: "blocked-external" };
}
