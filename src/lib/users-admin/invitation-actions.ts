"use server";

/**
 * Flujo PÚBLICO de aceptación de invitación (C-PR5, /invitacion/[token]).
 * Sin sesión: la credencial es el token del enlace (crypto.randomBytes(32)
 * hex, solo su sha256 en `user_invitations`). Anti-enumeración: cualquier
 * fallo de token (inexistente, expirado, quemado, usuario no-'invited')
 * responde con el MISMO código `invalid-token` — el cliente muestra «Este
 * enlace no es válido o expiró».
 */

import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { userInvitations, users } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security/events";
import { hashInvitationToken } from "@/lib/users-admin/tokens";

async function getRequestContext(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "unknown";
  const userAgent = h.get("user-agent") ?? "";
  return { ip, userAgent };
}

/**
 * Invitación válida = token con hash coincidente, no quemado, no expirado y
 * cuyo usuario sigue en status 'invited'. Devuelve null en cualquier otro
 * caso (una sola respuesta para todos los fallos — anti-enumeración).
 */
async function findValidInvitation(token: string) {
  if (!token || token.length < 32) return null;
  const tokenHash = hashInvitationToken(token);
  const [row] = await db
    .select({
      invitationId: userInvitations.id,
      userId: userInvitations.userId,
      userName: users.name,
      userStatus: users.status,
    })
    .from(userInvitations)
    .innerJoin(users, eq(users.id, userInvitations.userId))
    .where(
      and(
        eq(userInvitations.tokenHash, tokenHash),
        isNull(userInvitations.usedAt),
        gt(userInvitations.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!row || row.userStatus !== "invited") return null;
  return row;
}

export type CheckInvitationResult =
  | { valid: true; name: string }
  | { valid: false };

/** La usa el Server Component de /invitacion/[token] para decidir qué renderizar. */
export async function checkInvitationTokenAction(
  token: string
): Promise<CheckInvitationResult> {
  try {
    const row = await findValidInvitation(token);
    if (!row) return { valid: false };
    return { valid: true, name: row.userName };
  } catch (err) {
    console.error("[invitation] checkInvitationTokenAction error:", err);
    return { valid: false };
  }
}

export type AcceptInvitationResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid-token" | "too-short" | "weak" | "mismatch" | "rate-limited" | "unknown";
    };

/**
 * Acepta la invitación: fija contraseña (mismos requisitos que C-PR2 — mínimo
 * 8, al menos 1 letra y 1 número, confirmación), activa la cuenta y quema el
 * token — todo en UNA transacción.
 */
export async function acceptInvitationAction(
  token: string,
  password: string,
  confirmPassword: string
): Promise<AcceptInvitationResult> {
  if (password !== confirmPassword) return { ok: false, error: "mismatch" };
  if (password.length < 8) return { ok: false, error: "too-short" };
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, error: "weak" };
  }

  const { ip, userAgent } = await getRequestContext().catch(() => ({
    ip: "unknown",
    userAgent: "",
  }));

  const rl = await enforceRateLimit({
    ip,
    bucket: "invitation_accept",
    max: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) return { ok: false, error: "rate-limited" };

  try {
    const row = await findValidInvitation(token);
    if (!row) return { ok: false, error: "invalid-token" };

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, status: "active", updatedAt: now })
        .where(eq(users.id, row.userId));
      await tx
        .update(userInvitations)
        .set({ usedAt: now })
        .where(eq(userInvitations.id, row.invitationId));
    });

    // Auditoría fire-safe: la cuenta ya quedó activa.
    await recordSecurityEvent({
      userId: row.userId,
      type: "invitation_accepted",
      ip,
      userAgent,
    });

    return { ok: true };
  } catch (err) {
    console.error("[invitation] acceptInvitationAction error:", err);
    return { ok: false, error: "unknown" };
  }
}
