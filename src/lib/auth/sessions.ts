/**
 * Escritor ÚNICO de la tabla `user_sessions` (C-PR3, migración 0032).
 *
 * Modelo: cada login acuña una fila cuyo `id` (uuid) es el "sid" que viaja
 * dentro del JWT. El callback `jwt` (auth.config.ts) revalida el sid contra
 * esta tabla como máximo una vez por minuto; revocar la fila mata la sesión
 * en ≤60s sin abandonar `session.strategy: "jwt"`.
 *
 * Contratos de fallo — DECISIÓN DOCUMENTADA:
 * - `mintSession` es FIRE-SAFE: si la tabla no existe todavía (0032 se aplica
 *   en el deploy gobernado) o Postgres está caído, devuelve null y el login
 *   sigue — el rastro de sesión es auditoría, no una precondición del acceso.
 * - `validateSession` es FAIL-OPEN: ante un error de DB devuelve
 *   `{ valid: true }` con console.error. Razón: la validación del sid es una
 *   capa de revocación ADICIONAL sobre un JWT ya firmado y verificado; si un
 *   outage de la tabla se tradujera en `valid:false`, un incidente de
 *   infraestructura deslogearía a todo el equipo a la vez (fail-closed aquí
 *   convierte una caída de DB en un lockout global). El JWT firmado sigue
 *   siendo la autenticación primaria; esta tabla solo acelera la revocación.
 * - `revokeOtherSessions` NO es fire-safe: es una acción explícita del
 *   usuario y su fallo debe reportarse (el caller decide el mensaje).
 */

import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSessions } from "@/lib/db/schema";

/**
 * Acuña una sesión para `userId` y devuelve su sid (uuid), o null si la
 * escritura falla (fire-safe: el login jamás se bloquea por esto).
 */
export async function mintSession(
  userId: string,
  ip?: string,
  userAgent?: string
): Promise<string | null> {
  try {
    const [row] = await db
      .insert(userSessions)
      .values({ userId, ip: ip ?? null, userAgent: userAgent ?? null })
      .returning({ id: userSessions.id });
    return row?.id ?? null;
  } catch (err) {
    console.error("[sessions] mintSession failed — ignoring:", err);
    return null;
  }
}

/**
 * Valida que el sid exista, pertenezca a `userId` y no esté revocado.
 * Actualiza `last_seen_at` best-effort (su fallo no altera el veredicto).
 * FAIL-OPEN ante errores de DB — ver cabecera del archivo.
 */
export async function validateSession(
  sid: string,
  userId: string
): Promise<{ valid: boolean }> {
  try {
    const [row] = await db
      .select({ id: userSessions.id, revokedAt: userSessions.revokedAt })
      .from(userSessions)
      .where(and(eq(userSessions.id, sid), eq(userSessions.userId, userId)))
      .limit(1);

    if (!row || row.revokedAt) return { valid: false };

    // Best-effort: el rastro de actividad no puede tumbar una sesión válida.
    try {
      await db
        .update(userSessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(userSessions.id, sid));
    } catch (err) {
      console.error("[sessions] last_seen_at update failed — ignoring:", err);
    }

    return { valid: true };
  } catch (err) {
    // FAIL-OPEN: un outage de la tabla no desloguea a nadie (ver cabecera).
    console.error("[sessions] validateSession failed — failing OPEN:", err);
    return { valid: true };
  }
}

/**
 * Revoca todas las sesiones activas de `userId` excepto `keepSid` (la
 * actual). Devuelve cuántas filas se revocaron. Lanza si la DB falla —
 * es una acción explícita del usuario y su fallo debe verse.
 */
export async function revokeOtherSessions(
  userId: string,
  keepSid: string
): Promise<number> {
  const rows = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userSessions.userId, userId),
        isNull(userSessions.revokedAt),
        ne(userSessions.id, keepSid)
      )
    )
    .returning({ id: userSessions.id });
  return rows.length;
}

/** Sesiones activas (no revocadas) de un usuario, la más reciente primero. */
export async function listSessions(userId: string) {
  return db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
    .orderBy(desc(userSessions.lastSeenAt));
}
