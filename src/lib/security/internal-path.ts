/**
 * Única definición de "ruta interna segura" del proyecto.
 *
 * Existía duplicada y por partes: el redirect de `/login` comprobaba prefijos y
 * el `href` de notificaciones usaba su propia regex. Dos predicados distintos
 * para la misma pregunta significan que un bypass encontrado en uno no queda
 * cerrado en el otro — y de hecho ninguno rechazaba `/\evil.example`, que los
 * navegadores normalizan a `//evil.example` (protocol-relative) y resuelven
 * como host externo.
 *
 * El criterio no es sintáctico sino de ORIGEN: se resuelve el valor contra un
 * origen interno y se exige que el resultado siga en ese mismo origen. Eso
 * cubre de golpe backslashes, protocol-relative, URLs absolutas, `javascript:`
 * y cualquier normalización del parser de URL que no hayamos previsto.
 */

/** Origen ficticio y fijo para resolver rutas relativas. Nunca se navega a él. */
const INTERNAL_ORIGIN = "https://internal.invalid";

/**
 * `true` si `value` es una ruta relativa que se mantiene dentro del sitio.
 *
 * Rechaza: cadenas vacías, `//host`, `/\host`, `\\host`, URLs absolutas de
 * cualquier esquema (`https:`, `javascript:`, `data:`) y todo lo que al
 * resolverse cambie de origen.
 */
export function isInternalPath(value: string | null | undefined): value is string {
  if (typeof value !== "string" || value.length === 0) return false;

  // Debe empezar por "/" — descarta rutas relativas sin barra y esquemas.
  if (!value.startsWith("/")) return false;

  // El backslash es el caso que se escapaba: los navegadores tratan "\" como
  // "/" al normalizar, así que "/\evil.example" viaja como "//evil.example".
  if (value.includes("\\")) return false;

  // Protocol-relative explícito.
  if (value.startsWith("//")) return false;

  try {
    const resolved = new URL(value, INTERNAL_ORIGIN);
    return resolved.origin === INTERNAL_ORIGIN;
  } catch {
    return false;
  }
}

/**
 * Devuelve `value` si es una ruta interna; si no, `fallback`.
 * Pensado para destinos de navegación, donde siempre hay que ir a algún sitio.
 */
export function safeInternalPath(value: string | null | undefined, fallback = "/hoy"): string {
  return isInternalPath(value) ? value : fallback;
}
