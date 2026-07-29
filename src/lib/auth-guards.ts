import { db } from "@/lib/db";
import { infraAuditLog } from "@/lib/db/schema";
import { auth } from "@/lib/auth/config";

type GuardResult =
  | { ok: true; uid: string; isAdmin: boolean }
  | { ok: false; error: string; status: number };

/**
 * Identidad canonica (Gate B6): sesion y rol salen de auth() — `users.id` +
 * `users.role`. La auditoria de 403 registra users.id.
 */
export async function requireAdmin(
  _sessionCookie?: string,
  context?: { route: string; ip?: string; userAgent?: string }
): Promise<GuardResult> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return { ok: false, error: "Unauthorized", status: 401 };
  const isAdmin = session.user.role === "admin";

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
