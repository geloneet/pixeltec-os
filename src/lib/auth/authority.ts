/**
 * Autoridad canónica de autorización — Postgres, no el JWT.
 *
 * El JWT prueba **autenticación** (alguien presentó credenciales válidas y la
 * firma no está alterada). No prueba **autorización**: `role` se sella una vez,
 * al iniciar sesión, y desde entonces el token afirma un privilegio que la
 * realidad ya puede haber retirado. Degradar a alguien de admin a staff,
 * suspender su cuenta o borrar su fila no le quitaba nada mientras su cookie
 * siguiera viva (hasta 30 días).
 *
 * Aquí se releen de la base los cuatro hechos que deciden si una petición
 * procede — existencia, `status`, `role` y el corte de credenciales — en una
 * sola consulta por clave primaria.
 *
 * ## Cómo encaja con las otras dos capas de revocación
 *
 * | Capa | Alcance | Ante fallo de DB | Latencia |
 * |---|---|---|---|
 * | `user_sessions` (sid) | Un dispositivo | fail-**open** (deliberado) | ≤60 s |
 * | `users.status` | La cuenta entera | fail-**closed** (aquí) | inmediata |
 * | `sessions_valid_from` | Todos los tokens previos a un cambio de credenciales | fail-**closed** (aquí) | inmediata |
 *
 * Las tres conviven a propósito. El sid es quirúrgico ("cierra la sesión del
 * portátil que perdí") y se sacrifica a la disponibilidad: un outage de
 * Postgres no debe desloguear al equipo entero. Este módulo es lo contrario:
 * corre en la frontera de autorización, donde la base **ya es imprescindible**
 * para servir la petición, así que fallar cerrado no añade indisponibilidad —
 * si Postgres no responde, la petición no tenía nada que devolver de todos
 * modos.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type AuthorityDenial =
  | "unknown_user"
  | "suspended"
  | "not_active"
  | "credentials_changed";

export type AuthoritySnapshot =
  | { ok: true; userId: string; role: "admin" | "staff"; isAdmin: boolean }
  | { ok: false; reason: AuthorityDenial };

/**
 * `true` si el token es anterior al corte de credenciales del usuario.
 *
 * El margen de 1 segundo absorbe el redondeo de `iat` (segundos) frente al
 * timestamp de Postgres (milisegundos): sin él, quien acaba de cambiar su
 * contraseña se expulsaría a sí mismo por un desfase de milisegundos.
 */
export function isTokenRevoked(
  issuedAtSeconds: number | undefined,
  sessionsValidFrom: Date | null,
): boolean {
  if (!sessionsValidFrom) return false;
  // Sin `iat` no se puede fechar el token; con un corte activo, se rechaza.
  if (typeof issuedAtSeconds !== "number") return true;
  const cutoffSeconds = Math.floor(sessionsValidFrom.getTime() / 1000);
  return issuedAtSeconds + 1 < cutoffSeconds;
}

/**
 * Resuelve la autorización de una sesión contra Postgres.
 *
 * `issuedAtSeconds` es el `iat` del JWT (lo expone el callback `session`).
 * No lanza: devuelve un veredicto tipado para que el llamador elija 401/403.
 */
export async function resolveAuthority(
  userId: string,
  issuedAtSeconds: number | undefined,
): Promise<AuthoritySnapshot> {
  const [row] = await db
    .select({
      role: users.role,
      status: users.status,
      sessionsValidFrom: users.sessionsValidFrom,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Cuenta borrada: la cookie sigue siendo criptográficamente válida, pero ya
  // no hay a quién autorizar.
  if (!row) return { ok: false, reason: "unknown_user" };

  if (row.status === "suspended") return { ok: false, reason: "suspended" };
  // `invited` (contraseña aún sin fijar) tampoco opera: solo 'active' entra.
  if (row.status !== "active") return { ok: false, reason: "not_active" };

  if (isTokenRevoked(issuedAtSeconds, row.sessionsValidFrom)) {
    return { ok: false, reason: "credentials_changed" };
  }

  return { ok: true, userId, role: row.role, isAdmin: row.role === "admin" };
}

/** Estampa el corte global de credenciales del usuario. */
export async function revokeCredentialsFor(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ sessionsValidFrom: new Date() })
    .where(eq(users.id, userId));
}
