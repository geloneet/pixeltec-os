/**
 * Valores permitidos en `growthPosts.publishErrors` (E0f-3b).
 *
 * La columna es jsonb persistido Y viaja al cliente: `serializePostRow`
 * esparce la fila entera hacia las rutas GET de posts, y el catch de
 * `publishRowToAccount` devuelve el mismo texto al POST de publish. Por eso el
 * contrato es una lista blanca cerrada de mensajes públicos redactados por
 * nosotros — un `err.message` de Drizzle, de red o del SDK no entra ni a la
 * columna ni a la respuesta.
 *
 * Módulo sin imports a propósito: lo comparten `publish.ts` (escritura) y
 * `pg.ts` (lectura/serialización) sin crear ciclos entre ellos.
 */

/** Mensaje público único para cualquier fallo de publicación. */
export const PUBLISH_FAILED_MESSAGE = 'No fue posible publicar en esta red.';

/** Literal histórico del cron — ya era seguro y la UI puede depender de él. */
export const PUBLISH_NO_ACCOUNT_MESSAGE = 'Sin cuenta social conectada';

const SAFE_PUBLISH_ERROR_VALUES: ReadonlySet<string> = new Set([
  PUBLISH_FAILED_MESSAGE,
  PUBLISH_NO_ACCOUNT_MESSAGE,
]);

/**
 * Saneamiento en lectura para filas históricas: las escrituras anteriores a
 * E0f-3b guardaron `err.message` crudo, y esas filas NO se mutan aquí (la
 * limpieza física es un gate posterior al snapshot). Cualquier valor que no
 * esté en la lista blanca se reemplaza por el mensaje público al serializar.
 */
export function sanitizePublishErrors(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const sanitized: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    sanitized[key] =
      typeof entry === 'string' && SAFE_PUBLISH_ERROR_VALUES.has(entry)
        ? entry
        : PUBLISH_FAILED_MESSAGE;
  }
  return sanitized;
}
