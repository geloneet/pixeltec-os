/**
 * Resolver de la ruta pública `/respuestas/[id]` (D-22, WO-2026-00019).
 *
 * La URL canónica aprobada en la plantilla de WhatsApp es
 * `https://pixeltec.mx/respuestas/{id}`: una sola URL pública, genérica, que
 * NO está atada conceptualmente a un cliente. Cada tipo de respuesta que
 * exista en PixelTEC OS registra aquí cómo reconocer su id y a qué vista de
 * detalle redirigir. Añadir Encino u otro formulario = añadir un resolver a
 * la lista; ni la URL pública ni la plantilla de Meta cambian.
 *
 * Reglas:
 *   - id no reconocido por ningún resolver ⇒ `not-found` (404). Sin redirect
 *     a listados ni a home: un enlace roto debe verse roto.
 *   - El primer resolver que reconozca el id gana (orden = prioridad).
 *   - Sin tabla ni registry en DB: el código actual lo resuelve de forma
 *     simple y segura consultando el repo de cada tipo.
 */

import { getSmilemoreQaResponse } from "@/lib/smilemore-qa-repo";

export type RespuestaResolution =
  | { kind: "redirect"; href: string; source: string }
  | { kind: "not-found" };

export interface RespuestaResolver {
  /** Identificador estable del tipo de respuesta (para logs/evidencia). */
  source: string;
  /**
   * Devuelve el href interno de la vista de detalle si este resolver reconoce
   * el id, o null si no es suyo. No debe lanzar por un id malformado.
   */
  resolve(id: string): Promise<string | null>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cuestionario de levantamiento de Smile More (tabla smilemore_qa_responses). */
export const smilemoreQaResolver: RespuestaResolver = {
  source: "smilemore_qa",
  async resolve(id) {
    // uuid inválido reventaría el cast de Postgres — se filtra antes de tocar DB.
    if (!UUID_RE.test(id)) return null;
    const row = await getSmilemoreQaResponse(id);
    return row ? `/smilemore-respuestas/${row.id}` : null;
  },
};

/** Orden = prioridad. Nuevos tipos de respuesta se agregan aquí. */
export const RESPUESTA_RESOLVERS: readonly RespuestaResolver[] = [smilemoreQaResolver];

/**
 * Resuelve un id público a su vista de detalle interna.
 * Acepta la lista de resolvers como parámetro para poder probarla sin DB.
 */
export async function resolveRespuesta(
  id: string,
  resolvers: readonly RespuestaResolver[] = RESPUESTA_RESOLVERS
): Promise<RespuestaResolution> {
  const trimmed = (id ?? "").trim();
  if (!trimmed || trimmed.length > 128) return { kind: "not-found" };

  for (const resolver of resolvers) {
    const href = await resolver.resolve(trimmed);
    if (href) return { kind: "redirect", href, source: resolver.source };
  }
  return { kind: "not-found" };
}
