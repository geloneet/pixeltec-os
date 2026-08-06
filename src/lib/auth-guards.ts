import { db } from "@/lib/db";
import { infraAuditLog } from "@/lib/db/schema";
import { auth } from "@/lib/auth/config";
import { resolveAuthority } from "@/lib/auth/authority";

type GuardResult =
  | { ok: true; uid: string; isAdmin: boolean }
  | { ok: false; error: string; status: number };

/**
 * Puerta de las rutas de administración.
 *
 * La IDENTIDAD sale del JWT (`users.id`, sellado al autenticar); la
 * AUTORIZACIÓN se relee de Postgres en cada verificación vía
 * `resolveAuthority` — rol, estado de la cuenta y corte de credenciales. El
 * token afirma un privilegio del pasado: leerlo de ahí significaba que
 * degradar a un admin, suspenderlo o borrarlo no le quitaba nada hasta que su
 * cookie expirara (30 días). Una consulta por clave primaria en una superficie
 * de bajo tráfico es un precio menor que una revocación que no revoca.
 *
 * La auditoría de 403 registra users.id.
 */
export async function requireAdmin(
  _sessionCookie?: string,
  context?: { route: string; ip?: string; userAgent?: string }
): Promise<GuardResult> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return { ok: false, error: "Unauthorized", status: 401 };

  const authority = await resolveAuthority(uid, session.user.sessionIssuedAt);
  // Cuenta inexistente, suspendida, aún invitada o token anterior al último
  // cambio de credenciales: no hay a quién autorizar → 401, no 403.
  if (!authority.ok) return { ok: false, error: "Unauthorized", status: 401 };

  const isAdmin = authority.isAdmin;

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
