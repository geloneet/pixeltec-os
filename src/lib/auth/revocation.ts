/**
 * Revocación de sesiones con estrategia JWT.
 *
 * NextAuth v5 está configurado con `session.strategy: "jwt"`: no existe tabla
 * de sesiones que borrar, así que cambiar la contraseña no invalidaba nada —
 * una cookie robada seguía autenticando hasta expirar (30 días por defecto).
 * Eso rompe la expectativa universal de "restablece tu contraseña" como forma
 * de echar a un intruso.
 *
 * Mecanismo: al cambiar o restablecer la contraseña se estampa
 * `users.sessions_valid_from = now()`. Cualquier token cuyo `iat` sea ANTERIOR
 * a esa marca se considera revocado. La comparación no puede vivir en el
 * callback `jwt` (corre en el edge del middleware, sin acceso a Postgres), así
 * que se hace del lado servidor, donde ya hay base de datos.
 *
 * `sessions_valid_from` NULL significa "nunca se invalidó": comportamiento
 * idéntico al previo, así que activar esto no expulsa a nadie.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * `true` si el token fue emitido antes del corte de sesiones del usuario.
 *
 * El margen de 1 segundo absorbe el redondeo de `iat` (segundos) frente al
 * timestamp de Postgres (milisegundos): sin él, quien acaba de cambiar su
 * contraseña podría verse expulsado por un desfase de milisegundos.
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

/** Lee el corte de sesiones del usuario. `null` también si el usuario no existe. */
export async function sessionsValidFromFor(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ sessionsValidFrom: users.sessionsValidFrom })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.sessionsValidFrom ?? null;
}

/**
 * Marca como inválidas todas las sesiones vigentes del usuario.
 * Se llama en el mismo flujo que persiste la contraseña nueva.
 */
export async function revokeSessionsFor(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ sessionsValidFrom: new Date() })
    .where(eq(users.id, userId));
}
