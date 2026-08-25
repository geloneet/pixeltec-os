"use server";

/**
 * Server actions de Sistema → Usuarios y acceso (C-PR5). TODAS pasan por
 * `requireAdmin` (403 auditado en infra_audit_log) y registran su evento en
 * `security_events` con `actorUserId` = el admin que ejecuta.
 *
 * Guardas anti-lockout (invariante: SIEMPRE debe quedar ≥1 admin activo):
 * - Nadie puede degradarse a sí mismo ni auto-suspenderse.
 * - Degradar o suspender a un admin activo se bloquea si no queda ningún
 *   OTRO admin con status='active'.
 *
 * Suspender revoca TODAS las sesiones del usuario (la validación throttleada
 * del sid — C-PR3 — lo expulsa en ≤60s) e invalida invitaciones y tokens de
 * reset pendientes: una cuenta suspendida no conserva ninguna puerta abierta.
 */

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  passwordResetTokens,
  securityEvents,
  userInvitations,
  userMfa,
  userMfaRecoveryCodes,
  userSessions,
  users,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-guards";
import { revokeCredentialsFor } from "@/lib/auth/authority";
import { recordSecurityEvent } from "@/lib/security/events";
import { sendUserInvitationEmail } from "@/lib/email";
import { logSystemAlert } from "@/lib/system-alerts";
import {
  INVITATION_TTL_LABEL,
  INVITATION_TTL_MS,
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/users-admin/tokens";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:9002";

/**
 * Roles asignables desde /usuarios. `reviewer` (WO-2026-00051) es la cuenta de
 * mínimo privilegio para Meta App Review: solo /whatsapp y la allowlist de
 * /api/whatsapp-inbox (src/lib/routes/reviewer-access.ts).
 */
export type UserRole = "admin" | "staff" | "reviewer";
const ASSIGNABLE_ROLES: readonly UserRole[] = ["admin", "staff", "reviewer"];
function isAssignableRole(value: unknown): value is UserRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}
export type UserStatus = "active" | "invited" | "suspended";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  jobTitle: string | null;
  lastLoginAt: Date | null;
  mfaEnabled: boolean;
  createdAt: Date;
}

type GuardError = "unauthorized" | "forbidden";

async function getRequestContext(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "unknown";
  const userAgent = h.get("user-agent") ?? "";
  return { ip, userAgent };
}

/** Guard común: sesión admin + contexto de request para auditoría. */
async function guard(): Promise<
  | { ok: true; uid: string; ip: string; userAgent: string }
  | { ok: false; error: GuardError }
> {
  const { ip, userAgent } = await getRequestContext().catch(() => ({
    ip: "unknown",
    userAgent: "",
  }));
  const res = await requireAdmin(undefined, { route: "/usuarios", ip, userAgent });
  if (!res.ok) {
    return { ok: false, error: res.status === 401 ? "unauthorized" : "forbidden" };
  }
  return { ok: true, uid: res.uid, ip, userAgent };
}

async function getUserById(userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

/**
 * Guarda anti-lockout: cuántos admins ACTIVOS quedan sin contar al target.
 * Se cuenta excluyendo al target (no su estado actual) para que la regla sea
 * la misma en degradación y suspensión: si el resultado es 0, la operación
 * dejaría el sistema sin ningún admin capaz de entrar.
 */
async function countOtherActiveAdmins(excludeUserId: string): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.role, "admin"), eq(users.status, "active"), ne(users.id, excludeUserId))
    );
  return rows.length;
}

/** Revoca todas las sesiones vivas de un usuario. Devuelve cuántas. */
async function revokeAllSessions(userId: string): Promise<number> {
  const rows = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
    .returning({ id: userSessions.id });
  return rows.length;
}

// ─── Listado ──────────────────────────────────────────────────────────────────

export type ListUsersResult =
  | { ok: true; users: AdminUserRow[] }
  | { ok: false; error: GuardError | "unknown" };

export async function listUsersAction(): Promise<ListUsersResult> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        jobTitle: users.jobTitle,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    // 2FA aparte y fire-safe: si user_mfa (0033) aún no existe en la base,
    // el listado sigue funcionando mostrando 2FA como no configurada.
    const mfaEnabledIds = new Set<string>();
    try {
      const mfaRows = await db
        .select({ userId: userMfa.userId, enabledAt: userMfa.enabledAt })
        .from(userMfa);
      for (const r of mfaRows) if (r.enabledAt) mfaEnabledIds.add(r.userId);
    } catch (err) {
      console.error("[users-admin] user_mfa read failed — showing as disabled:", err);
    }

    return {
      ok: true,
      users: rows.map((r) => ({ ...r, mfaEnabled: mfaEnabledIds.has(r.id) })),
    };
  } catch (err) {
    console.error("[users-admin] listUsersAction error:", err);
    return { ok: false, error: "unknown" };
  }
}

// ─── Invitaciones ─────────────────────────────────────────────────────────────

export type InviteUserResult =
  | { ok: true; emailSent: boolean }
  | { ok: false; error: GuardError | "invalid-email" | "invalid-role" | "email-exists" | "unknown" };

export async function inviteUserAction(input: {
  email: string;
  name: string;
  role: UserRole;
}): Promise<InviteUserResult> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const email = input.email?.trim().toLowerCase() ?? "";
  const name = input.name?.trim() ?? "";
  if (!email || !/\S+@\S+\.\S+/.test(email) || !name) {
    return { ok: false, error: "invalid-email" };
  }
  if (!isAssignableRole(input.role)) {
    return { ok: false, error: "invalid-role" };
  }

  try {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing) return { ok: false, error: "email-exists" };

    // Hash aleatorio inusable: la cuenta 'invited' no puede loguearse por
    // contraseña hasta aceptar la invitación (y además authorize() rechaza
    // cualquier status != 'active').
    const unusablePasswordHash = await bcrypt.hash(
      crypto.randomBytes(32).toString("hex"),
      12
    );
    const rawToken = generateInvitationToken();

    const invitedUserId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          email,
          name,
          role: input.role,
          status: "invited",
          passwordHash: unusablePasswordHash,
        })
        .returning({ id: users.id });
      await tx.insert(userInvitations).values({
        userId: created.id,
        tokenHash: hashInvitationToken(rawToken),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        createdBy: g.uid,
      });
      return created.id;
    });

    await recordSecurityEvent({
      userId: invitedUserId,
      actorUserId: g.uid,
      type: "user_invited",
      ip: g.ip,
      userAgent: g.userAgent,
      metadata: { role: input.role },
    });

    const emailSent = await deliverInvitationEmail(invitedUserId, name, email, rawToken);
    return { ok: true, emailSent };
  } catch (err) {
    console.error("[users-admin] inviteUserAction error:", err);
    return { ok: false, error: "unknown" };
  }
}

/** Envío del correo de invitación — fire-safe: la cuenta ya quedó creada. */
async function deliverInvitationEmail(
  userId: string,
  name: string,
  email: string,
  rawToken: string
): Promise<boolean> {
  try {
    const result = await sendUserInvitationEmail({
      email,
      name,
      inviteUrl: `${APP_URL}/invitacion/${rawToken}`,
      expiresIn: INVITATION_TTL_LABEL,
    });
    if (!result.success) {
      console.error("[users-admin] sendUserInvitationEmail failed:", result.error);
      await logSystemAlert({
        severity: "warning",
        source: "user_invitation",
        message: `Envío de invitación falló para ${userId}`,
        context: { error: result.error },
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error("[users-admin] invitation email error — ignoring:", err);
    return false;
  }
}

export type ResendInvitationResult =
  | { ok: true; emailSent: boolean }
  | { ok: false; error: GuardError | "not-found" | "not-invited" | "unknown" };

export async function resendInvitationAction(userId: string): Promise<ResendInvitationResult> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const target = await getUserById(userId);
    if (!target) return { ok: false, error: "not-found" };
    if (target.status !== "invited") return { ok: false, error: "not-invited" };

    const rawToken = generateInvitationToken();
    await db.transaction(async (tx) => {
      // Invalida (quema) todos los tokens previos pendientes: solo el enlace
      // más reciente puede activar la cuenta.
      await tx
        .update(userInvitations)
        .set({ usedAt: new Date() })
        .where(and(eq(userInvitations.userId, userId), isNull(userInvitations.usedAt)));
      await tx.insert(userInvitations).values({
        userId,
        tokenHash: hashInvitationToken(rawToken),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        createdBy: g.uid,
      });
    });

    await recordSecurityEvent({
      userId,
      actorUserId: g.uid,
      type: "invitation_resent",
      ip: g.ip,
      userAgent: g.userAgent,
    });

    const emailSent = await deliverInvitationEmail(userId, target.name, target.email, rawToken);
    return { ok: true, emailSent };
  } catch (err) {
    console.error("[users-admin] resendInvitationAction error:", err);
    return { ok: false, error: "unknown" };
  }
}

// ─── Rol ──────────────────────────────────────────────────────────────────────

export type SetUserRoleResult =
  | { ok: true }
  | {
      ok: false;
      error: GuardError | "not-found" | "invalid-role" | "self-demotion" | "last-admin" | "unknown";
    };

export async function setUserRoleAction(
  userId: string,
  role: UserRole
): Promise<SetUserRoleResult> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  if (!isAssignableRole(role)) return { ok: false, error: "invalid-role" };

  // Anti-lockout 1: prohibido degradarse a sí mismo (a staff O a reviewer) —
  // evita que el último admin operativo se quite el rol desde su propia sesión.
  if (userId === g.uid && role !== "admin") {
    return { ok: false, error: "self-demotion" };
  }

  try {
    const target = await getUserById(userId);
    if (!target) return { ok: false, error: "not-found" };
    if (target.role === role) return { ok: true };

    // Anti-lockout 2: degradar a un admin (a staff o a reviewer) exige que
    // quede al menos otro admin activo (se cuenta excluyendo al target).
    if (target.role === "admin" && role !== "admin") {
      const others = await countOtherActiveAdmins(userId);
      if (others === 0) return { ok: false, error: "last-admin" };
    }

    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));

    // WO-2026-00051: si la transición entra o sale de `reviewer`, se estampa el
    // corte global de credenciales. El callback `jwt` ya refresca el rol desde
    // Postgres en cada request, pero el corte mata además cualquier token
    // previo en las fronteras fail-closed (`resolveAuthority` →
    // credentials_changed), sin depender de la disponibilidad de ese refresco.
    // Admin↔staff conserva el comportamiento anterior (sin corte).
    if (target.role === "reviewer" || role === "reviewer") {
      try {
        await revokeCredentialsFor(userId);
      } catch (err) {
        // El rol YA cambió (y la autoridad canónica lo relee por request); el
        // corte es defensa en profundidad, no la única barrera.
        console.error("[users-admin] revokeCredentialsFor on reviewer transition failed:", err);
      }
    }

    await recordSecurityEvent({
      userId,
      actorUserId: g.uid,
      type: "role_changed",
      ip: g.ip,
      userAgent: g.userAgent,
      metadata: { from: target.role, to: role },
    });

    return { ok: true };
  } catch (err) {
    console.error("[users-admin] setUserRoleAction error:", err);
    return { ok: false, error: "unknown" };
  }
}

// ─── Suspensión / reactivación ────────────────────────────────────────────────

export type SuspendUserResult =
  | { ok: true; revokedSessions: number }
  | {
      ok: false;
      error: GuardError | "not-found" | "self-suspend" | "last-admin" | "already-suspended" | "unknown";
    };

export async function suspendUserAction(userId: string): Promise<SuspendUserResult> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  // Anti-lockout 1: nadie se suspende a sí mismo.
  if (userId === g.uid) return { ok: false, error: "self-suspend" };

  try {
    const target = await getUserById(userId);
    if (!target) return { ok: false, error: "not-found" };
    if (target.status === "suspended") return { ok: false, error: "already-suspended" };

    // Anti-lockout 2: suspender a un admin exige otro admin activo.
    if (target.role === "admin") {
      const others = await countOtherActiveAdmins(userId);
      if (others === 0) return { ok: false, error: "last-admin" };
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ status: "suspended", updatedAt: now })
        .where(eq(users.id, userId));
      // Invalida cualquier puerta pendiente: invitaciones y resets vivos.
      await tx
        .update(userInvitations)
        .set({ usedAt: now })
        .where(and(eq(userInvitations.userId, userId), isNull(userInvitations.usedAt)));
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
    });

    // Revoca TODAS sus sesiones: la validación throttleada del sid (C-PR3)
    // lo expulsa en ≤60s. Fuera de la transacción a propósito: si fallara,
    // la cuenta ya quedó suspendida (authorize() la rechaza) y el fallo se
    // reporta sin revertir la suspensión.
    let revokedSessions = 0;
    try {
      revokedSessions = await revokeAllSessions(userId);
    } catch (err) {
      console.error("[users-admin] revokeAllSessions on suspend failed:", err);
    }

    await recordSecurityEvent({
      userId,
      actorUserId: g.uid,
      type: "user_suspended",
      ip: g.ip,
      userAgent: g.userAgent,
      metadata: { revokedSessions },
    });

    return { ok: true, revokedSessions };
  } catch (err) {
    console.error("[users-admin] suspendUserAction error:", err);
    return { ok: false, error: "unknown" };
  }
}

export type ReactivateUserResult =
  | { ok: true }
  | { ok: false; error: GuardError | "not-found" | "not-suspended" | "unknown" };

export async function reactivateUserAction(userId: string): Promise<ReactivateUserResult> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const target = await getUserById(userId);
    if (!target) return { ok: false, error: "not-found" };
    if (target.status !== "suspended") return { ok: false, error: "not-suspended" };

    await db
      .update(users)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(users.id, userId));

    await recordSecurityEvent({
      userId,
      actorUserId: g.uid,
      type: "user_reactivated",
      ip: g.ip,
      userAgent: g.userAgent,
    });

    return { ok: true };
  } catch (err) {
    console.error("[users-admin] reactivateUserAction error:", err);
    return { ok: false, error: "unknown" };
  }
}

// ─── Sesiones y 2FA ───────────────────────────────────────────────────────────

export type RevokeUserSessionsResult =
  | { ok: true; revoked: number }
  | { ok: false; error: GuardError | "unknown" };

export async function revokeUserSessionsAction(
  userId: string
): Promise<RevokeUserSessionsResult> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const revoked = await revokeAllSessions(userId);
    await recordSecurityEvent({
      userId,
      actorUserId: g.uid,
      type: "sessions_revoked",
      ip: g.ip,
      userAgent: g.userAgent,
      metadata: { revoked, byAdmin: true },
    });
    return { ok: true, revoked };
  } catch (err) {
    console.error("[users-admin] revokeUserSessionsAction error:", err);
    return { ok: false, error: "unknown" };
  }
}

export type ResetUserMfaResult =
  | { ok: true }
  | { ok: false; error: GuardError | "unknown" };

/**
 * Break-glass 2FA (C-PR4 documentaba el DELETE manual por psql; esto es la
 * versión gobernada): borra el enrolamiento TOTP y los códigos de
 * recuperación. El usuario vuelve a "2FA no configurada".
 */
export async function resetUserMfaAction(userId: string): Promise<ResetUserMfaResult> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await db.transaction(async (tx) => {
      await tx.delete(userMfaRecoveryCodes).where(eq(userMfaRecoveryCodes.userId, userId));
      await tx.delete(userMfa).where(eq(userMfa.userId, userId));
    });

    await recordSecurityEvent({
      userId,
      actorUserId: g.uid,
      type: "mfa_reset_by_admin",
      ip: g.ip,
      userAgent: g.userAgent,
    });

    return { ok: true };
  } catch (err) {
    console.error("[users-admin] resetUserMfaAction error:", err);
    return { ok: false, error: "unknown" };
  }
}

// ─── Eventos ──────────────────────────────────────────────────────────────────

export interface UserSecurityEventRow {
  id: string;
  type: string;
  actorUserId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;
}

export type GetUserSecurityEventsResult =
  | { ok: true; events: UserSecurityEventRow[] }
  | { ok: false; error: GuardError | "unknown" };

export async function getUserSecurityEventsAction(
  userId: string,
  limit = 20
): Promise<GetUserSecurityEventsResult> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const events = await db
      .select({
        id: securityEvents.id,
        type: securityEvents.type,
        actorUserId: securityEvents.actorUserId,
        ip: securityEvents.ip,
        userAgent: securityEvents.userAgent,
        metadata: securityEvents.metadata,
        createdAt: securityEvents.createdAt,
      })
      .from(securityEvents)
      .where(eq(securityEvents.userId, userId))
      .orderBy(desc(securityEvents.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return { ok: true, events };
  } catch (err) {
    console.error("[users-admin] getUserSecurityEventsAction error:", err);
    return { ok: false, error: "unknown" };
  }
}
