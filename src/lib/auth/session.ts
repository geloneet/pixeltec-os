import { auth } from "@/lib/auth/config";
import { AUTH_SESSION_USER_ID_MISSING } from "@/lib/auth/auth.config";

/**
 * Resolución de identidad de sesión.
 *
 * La identidad canónica de PixelTEC OS es `users.id` (uuid de Postgres): es lo
 * que referencian por clave foránea los `owner_id` de todas las tablas de
 * negocio. `firebaseUid` es un alias heredado de la migración a Postgres y no
 * participa en la resolución.
 */

/**
 * Devuelve `users.id` de la sesión actual, o `null` si no hay sesión.
 *
 * Distingue dos casos que antes se confundían en un mismo `null`:
 *
 *  - **Sin sesión** — visitante no autenticado. `null` normal y esperado: quien
 *    llame debe redirigir o responder 401.
 *  - **Sesión autenticada sin `id`** — violación de invariante, no un estado de
 *    autenticación. Significaría un token corrupto o un `authorize()` que
 *    devolvió un usuario sin id. **Lanza**, no degrada.
 *
 * Por qué lanzar en vez de devolver `null` o una cadena vacía: un identificador
 * vacío no es rechazado por las consultas, se propaga como `ownerId` y devuelve
 * datos de nadie sin que nada avise. Fallar aquí es ruidoso; degradar es
 * silencioso y peor. Nunca devuelve `""`.
 *
 * En la práctica el callback `session` de NextAuth ya rechaza estos tokens
 * antes, así que esta guarda es la segunda línea.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;
  if (typeof userId !== "string" || userId.length === 0) {
    console.error("[auth] sesión sin users.id — identidad no resoluble");
    throw new Error(AUTH_SESSION_USER_ID_MISSING);
  }
  return userId;
}

/**
 * Contrato mínimo de la sesión canónica (Gate B1 — Firebase Exit).
 * `firebaseUid` NO forma parte del contrato: una cuenta con el alias en
 * `null` opera idéntico a una con alias.
 */
export interface UserSession {
  /** Identidad canónica: `users.id` (uuid de Postgres). */
  userId: string;
  email: string;
  /** Rol tal cual viaja en el JWT; la autorización vive en `@/lib/auth-guards`. */
  role?: string;
}

/**
 * Frontera canónica de sesión (Gate B1 — Firebase Exit).
 *
 * - `null` — sin sesión: el caller responde 401 o redirige (estado normal).
 * - **Lanza** `AUTH_SESSION_USER_ID_MISSING` si la sesión existe pero viola el
 *   invariante (sin `users.id` o sin `email`): mismo criterio ruidoso que
 *   {@link getSessionUserId} — un identificador vacío se propagaría como
 *   `ownerId` y devolvería datos de nadie sin avisar.
 *
 * Sustituye progresivamente a `getSessionUid`/`requireSession` (módulos
 * migran por gates B2-B5); no lee ni expone `firebaseUid` jamás.
 */
export async function requireUserSession(): Promise<UserSession | null> {
  const session = await auth();
  if (!session?.user) return null;

  const { id, email, role } = session.user;
  if (typeof id !== "string" || id.length === 0 || typeof email !== "string" || email.length === 0) {
    console.error("[auth] sesión sin users.id/email — identidad no resoluble");
    throw new Error(AUTH_SESSION_USER_ID_MISSING);
  }
  return { userId: id, email, role: role ?? undefined };
}

/**
 * @deprecated Devuelve el alias heredado `firebaseUid`, no la identidad
 * canónica. Las cuentas creadas tras la migración lo tienen a `null`, así que
 * esta función las trata como no autenticadas aunque su sesión sea válida — ese
 * es el defecto que la remediación corrige. Usar {@link getSessionUserId}.
 * Se elimina al cerrar la remediación; sus consumidores migran por bloques.
 *
 * El guard de administración real vive en `@/lib/auth-guards`, que deriva el rol
 * de `users.role`. Aquí hubo un `requireAdmin()` homónimo sin ningún consumidor:
 * se eliminó en el Gate B1 en vez de migrarse.
 */
export async function getSessionUid(): Promise<string | null> {
  const session = await auth();
  return session?.user?.firebaseUid ?? null;
}
