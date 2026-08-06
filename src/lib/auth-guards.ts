import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { infraAuditLog, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth/config";
import { isTokenRevoked } from "@/lib/auth/revocation";

type GuardResult =
  | { ok: true; uid: string; isAdmin: boolean }
  | { ok: false; error: string; status: number };

/**
 * Identidad canónica (Gate B6): la sesión sale de auth() — `users.id`.
 *
 * El ROL se relee de Postgres en cada verificación y NO se toma del JWT. La
 * estrategia de sesión es `jwt` y el rol se sella una sola vez, al iniciar
 * sesión: sin esta relectura, degradar a alguien de admin a staff (o borrar su
 * fila) no le quitaba nada — su cookie seguía decodificando `role: "admin"` y
 * estas rutas seguían abriéndose hasta que el token expirara (30 días por
 * defecto) o cerrara sesión por su cuenta. Una consulta por PK en una
 * superficie de bajo tráfico es un precio menor que una revocación que no revoca.
 */
export async function requireAdmin(
  _sessionCookie?: string,
  context?: { route: string; ip?: string; userAgent?: string }
): Promise<GuardResult> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return { ok: false, error: "Unauthorized", status: 401 };

  const [row] = await db
    .select({ role: users.role, sessionsValidFrom: users.sessionsValidFrom })
    .from(users)
    .where(eq(users.id, uid))
    .limit(1);

  // Usuario borrado: la cookie sigue siendo criptográficamente válida, pero la
  // identidad ya no existe. 401, no 403 — no hay a quién autorizar.
  if (!row) return { ok: false, error: "Unauthorized", status: 401 };

  // Token anterior al último cambio de contraseña (misma fila ya leída, sin
  // consulta extra).
  if (isTokenRevoked(session.user.sessionIssuedAt, row.sessionsValidFrom)) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const isAdmin = row.role === "admin";

  if (!isAdmin) {
    if (context) {
      db.insert(infraAuditLog)
        .values({
          type: "forbidden_access_attempt",
          uid,
          route: context.route,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
        })
        .catch((err) => console.error("[audit] failed to log 403:", err));
    }
    return { ok: false, error: "forbidden", status: 403 };
  }

  return { ok: true, uid, isAdmin: true };
}
