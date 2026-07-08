import { requireSession } from "@/lib/vpsClient";
import { db } from "@/lib/db";
import { infraAuditLog } from "@/lib/db/schema";
import { auth } from "@/lib/auth/config";

type GuardResult =
  | { ok: true; uid: string; isAdmin: boolean }
  | { ok: false; error: string; status: number };

/**
 * Fase 2 de la migración: el rol de admin ahora vive en `users.role`
 * (Postgres), no en `ADMIN_UIDS` (env) — reemplaza esa comprobación.
 * `requireSession` ya no valida contra Firebase, ver el comentario en
 * vpsClient.ts.
 */
export async function requireAdmin(
  sessionCookie?: string,
  context?: { route: string; ip?: string; userAgent?: string }
): Promise<GuardResult> {
  const session = await requireSession(sessionCookie);
  if (!session.ok) return { ok: false, error: session.error, status: 401 };

  const nextAuthSession = await auth();
  const isAdmin = nextAuthSession?.user?.role === "admin";

  if (!isAdmin) {
    if (context) {
      db.insert(infraAuditLog)
        .values({
          type: "forbidden_access_attempt",
          uid: session.uid,
          route: context.route,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
        })
        .catch((err) => console.error("[audit] failed to log 403:", err));
    }
    return { ok: false, error: "forbidden", status: 403 };
  }

  return { ok: true, uid: session.uid, isAdmin: true };
}
