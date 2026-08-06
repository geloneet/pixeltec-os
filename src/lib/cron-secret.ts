/**
 * Validación del secreto de las rutas cron en tiempo constante.
 *
 * Vive aparte de `cron-guard.ts` a propósito: esa guarda documenta que jamás
 * lee `CRON_SECRET` (autenticación y autorización de ejecución son controles
 * separados). Aquí solo se compara; nunca se registra ni se propaga.
 *
 * `timingSafeEqual` en vez de `!==`: mismo criterio que el HMAC del portal y
 * el state de OAuth — un comparador de cortocircuito filtra por timing cuántos
 * bytes del secreto coinciden.
 */
import { timingSafeEqual } from "node:crypto";

export function cronSecretMatches(provided: string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  // La longitud se filtra igual con timingSafeEqual (exige buffers iguales);
  // compararla antes no revela más de lo inevitable.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Extrae el token de `Authorization: Bearer X` (o null si no viene así). */
export function bearerToken(header: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}
