/**
 * Clasificación de las rutas internas de PixelBot.
 *
 * Existe aparte del cliente por dos razones. La primera es que decidir «qué
 * riesgo tiene esta llamada» es lógica pura y se prueba sin tocar `fetch`. La
 * segunda es que el criterio por defecto aquí es **bloquear**: una ruta que no
 * esté en esta tabla no sale. Si el mapa viviera dentro del cliente, junto al
 * código que construye la petición, la tentación de dejar pasar lo desconocido
 * sería mucho mayor.
 *
 * El método importa: `/internal/config` es una lectura con GET y una mutación
 * con PUT, y `/internal/examples` lo mismo con GET y POST. Clasificar solo por
 * ruta daría a una escritura el permiso de una lectura.
 */

import type { InternalOperation } from "@/lib/egress-guard";

export type PixelbotMethod = "GET" | "POST" | "PUT";

/**
 * Tabla completa de rutas conocidas: 6 lecturas, 9 escrituras y 1 envío real.
 * Los segmentos dinámicos (`{phone}`, `{id}`) se expresan como `[^/]+` porque
 * el llamador ya los codifica con `encodeURIComponent`.
 */
const KNOWN_ROUTES: ReadonlyArray<{
  pattern: RegExp;
  method: PixelbotMethod;
  operation: InternalOperation;
}> = [
  // Lecturas
  { pattern: /^\/internal\/config$/, method: "GET", operation: "read" },
  { pattern: /^\/internal\/config\/versions$/, method: "GET", operation: "read" },
  { pattern: /^\/internal\/conversations$/, method: "GET", operation: "read" },
  // El teléfono llega ya pasado por `encodeURIComponent`: dígitos, `%2B` y los
  // separadores que sobreviven a la codificación. Nada más.
  {
    pattern: /^\/internal\/conversations\/[A-Za-z0-9%._+-]+\/messages$/,
    method: "GET",
    operation: "read",
  },
  { pattern: /^\/internal\/examples$/, method: "GET", operation: "read" },
  { pattern: /^\/internal\/memory$/, method: "GET", operation: "read" },

  // Escrituras
  { pattern: /^\/internal\/config$/, method: "PUT", operation: "write" },
  { pattern: /^\/internal\/config\/draft$/, method: "POST", operation: "write" },
  { pattern: /^\/internal\/config\/publish$/, method: "POST", operation: "write" },
  { pattern: /^\/internal\/config\/rollback$/, method: "POST", operation: "write" },
  { pattern: /^\/internal\/conversations\/read$/, method: "POST", operation: "write" },
  { pattern: /^\/internal\/conversations\/mode$/, method: "POST", operation: "write" },
  { pattern: /^\/internal\/examples$/, method: "POST", operation: "write" },
  // El id de un ejemplo es un entero de PixelBot: nada más pasa.
  { pattern: /^\/internal\/examples\/[0-9]+\/active$/, method: "POST", operation: "write" },
  { pattern: /^\/internal\/simulate$/, method: "POST", operation: "write" },

  // Envío real a un cliente
  { pattern: /^\/internal\/send$/, method: "POST", operation: "send_message" },
];

/** Cualquier indicio de que el «path» no es un path. */
function tieneFormaSospechosa(path: string): boolean {
  return (
    path.includes("..") ||
    path.toLowerCase().includes("%2e") || // traversal codificado
    path.includes("\\") ||
    /\s/.test(path) || // inyección de cabeceras
    /^[a-z][a-z0-9+.-]*:/i.test(path) || // esquema absoluto: http:, file:, …
    path.startsWith("//") // URL protocol-relative
  );
}

/**
 * Devuelve la operación de una ruta interna, o `null` si no se reconoce.
 *
 * `null` significa **bloquear**, nunca «probablemente sea una lectura».
 */
export function classifyPixelbotPath(
  path: string,
  method: PixelbotMethod
): InternalOperation | null {
  if (typeof path !== "string" || !path.startsWith("/internal/")) return null;
  if (tieneFormaSospechosa(path)) return null;

  // La query no participa en la clasificación: la construyen nuestras rutas y
  // ya viene codificada. Lo que decide el permiso es la ruta.
  const pathname = path.split("?")[0];

  const match = KNOWN_ROUTES.find(
    (route) => route.method === method && route.pattern.test(pathname)
  );
  return match?.operation ?? null;
}
