import { requireSession } from "@/lib/vpsClient";
import { db } from "@/lib/assistant/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const ADMIN_UIDS = (process.env.ADMIN_UIDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type GuardResult =
  | { ok: true; uid: string; isAdmin: boolean }
  | { ok: false; error: string; status: number };

export async function requireAdmin(
  sessionCookie?: string,
  context?: { route: string; ip?: string; userAgent?: string }
): Promise<GuardResult> {
  const session = await requireSession(sessionCookie);
  if (!session.ok) return { ok: false, error: session.error, status: 401 };

  if (!ADMIN_UIDS.includes(session.uid)) {
    if (context) {
      db()
        .collection("infraAuditLog")
        .add({
          type: "forbidden_access_attempt",
          uid: session.uid,
          route: context.route,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          timestamp: FieldValue.serverTimestamp(),
        })
        .catch((err) => console.error("[audit] failed to log 403:", err));
    }
    return { ok: false, error: "forbidden", status: 403 };
  }

  return { ok: true, uid: session.uid, isAdmin: true };
}
