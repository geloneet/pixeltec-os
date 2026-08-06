/**
 * Escritor ÚNICO de la tabla `security_events` (C-PR2, migración 0031).
 *
 * Contrato: FIRE-SAFE. Registrar un evento de seguridad es auditoría, no
 * lógica de negocio — un fallo aquí (Postgres caído, tabla aún no migrada
 * porque 0031 se aplica en el deploy gobernado, etc.) JAMÁS debe impedir un
 * login ni un cambio de contraseña. Por eso captura toda excepción y solo
 * la reporta por consola.
 */

import { db } from "@/lib/db";
import { securityEvents } from "@/lib/db/schema";

/**
 * Unión extensible: los cinco tipos conocidos autocompletados + cualquier
 * string futuro sin tocar este archivo (`string & {}` conserva el
 * autocomplete sin cerrar el tipo).
 */
export type SecurityEventType =
  | "login_success"
  | "login_failed"
  | "password_changed"
  | "password_reset_requested"
  | "password_reset_completed"
  // C-PR5 — Sistema → Usuarios y acceso
  | "user_invited"
  | "invitation_resent"
  | "invitation_accepted"
  | "role_changed"
  | "user_suspended"
  | "user_reactivated"
  | "sessions_revoked"
  | "mfa_reset_by_admin"
  | (string & {});

export interface RecordSecurityEventInput {
  /** Usuario afectado por el evento (nullable en tabla vía ON DELETE SET NULL). */
  userId: string;
  /** Quien ejecutó la acción, si difiere del afectado (ej. admin futuro). */
  actorUserId?: string;
  type: SecurityEventType;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function recordSecurityEvent(input: RecordSecurityEventInput): Promise<void> {
  try {
    await db.insert(securityEvents).values({
      userId: input.userId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    // Fire-safe: tolera incluso que la tabla no exista todavía (0031 sin aplicar).
    console.error("[securityEvents] record failed — ignoring", { type: input.type, err });
  }
}
