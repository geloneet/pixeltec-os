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
