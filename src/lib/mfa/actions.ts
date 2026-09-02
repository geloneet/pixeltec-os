"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { userMfa, userMfaRecoveryCodes, users } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security/events";
import { MFA_KEY_ERROR, decryptSecret, encryptSecret } from "./crypto";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  isTotpFormat,
  verifyTotp,
} from "./totp";

/**
 * Server actions de la verificación en dos pasos (C-PR4). El secreto TOTP
 * solo existe en claro durante el enrolamiento (QR + confirmación); en DB
 * siempre viaja cifrado (crypto.ts). Los códigos de recuperación se
 * devuelven EN CLARO una única vez, al confirmar; después solo existe su
 * sha256.
 */

async function getRequestContext(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "unknown";
  const userAgent = h.get("user-agent") ?? "";
  return { ip, userAgent };
}

export interface MfaStatus {
  enabled: boolean;
  pendingEnrollment: boolean;
}

/**
 * Estado 2FA del usuario autenticado. Fire-safe: si la tabla 0033 no existe
 * aún, se reporta como no configurada (nadie pudo enrolar sin la tabla).
 */
export async function getMfaStatus(): Promise<MfaStatus> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { enabled: false, pendingEnrollment: false };
  try {
    const [row] = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
    return { enabled: Boolean(row?.enabledAt), pendingEnrollment: Boolean(row && !row.enabledAt) };
  } catch (err) {
    console.error("[mfa] getMfaStatus read failed — reporting disabled:", err);
    return { enabled: false, pendingEnrollment: false };
  }
}

export type StartMfaEnrollmentResult =
  | { ok: true; otpauthUri: string; qrDataUrl: string }
  | { ok: false; error: "no-session" | "already-enabled" | "no-key" | "rate-limited" | "unknown" };

/**
 * Inicia el enrolamiento: genera el secreto, lo guarda cifrado con
 * `enabled_at` NULL (pendiente) y devuelve el URI otpauth:// + QR. Repetir
 * la llamada antes de confirmar regenera el secreto (el QR anterior deja de
 * valer). La ausencia de MFA_ENCRYPTION_KEY falla AQUÍ con código claro —
 * no al arrancar la app.
 */
export async function startMfaEnrollment(): Promise<StartMfaEnrollmentResult> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId) return { ok: false, error: "no-session" };

  const rl = await enforceRateLimit({ bucket: "mfa", ip: userId, max: 10, windowMs: 15 * 60_000 });
  if (!rl.allowed) return { ok: false, error: "rate-limited" };

  try {
    const [existing] = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
    if (existing?.enabledAt) return { ok: false, error: "already-enabled" };

    const secret = generateSecret();
    let secretEnc: string;
    try {
      secretEnc = encryptSecret(secret);
    } catch (err) {
      console.error("[mfa] startMfaEnrollment encrypt failed:", err);
      return {
        ok: false,
        error: err instanceof Error && err.message.includes(MFA_KEY_ERROR) ? "no-key" : "unknown",
      };
    }

    await db
      .insert(userMfa)
      .values({ userId, secretEnc })
      .onConflictDoUpdate({ target: userMfa.userId, set: { secretEnc, enabledAt: null, lastUsedStep: null } });

    const otpauthUri = generateURI({
      issuer: "Pixeltec.mx",
      label: email ?? userId,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 240 });
    return { ok: true, otpauthUri, qrDataUrl };
  } catch (err) {
    console.error("[mfa] startMfaEnrollment failed:", err);
    return { ok: false, error: "unknown" };
  }
}

export type ConfirmMfaEnrollmentResult =
  | { ok: true; recoveryCodes: string[] }
  | { ok: false; error: "no-session" | "no-pending" | "invalid-code" | "rate-limited" | "unknown" };

/**
 * Confirma el enrolamiento verificando un TOTP contra el secreto pendiente.
 * Activa la fila (`enabled_at = now`), fija el anti-replay al paso usado y
 * genera 10 códigos de recuperación — devueltos EN CLARO una única vez.
 */
export async function confirmMfaEnrollment(code: string): Promise<ConfirmMfaEnrollmentResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "no-session" };

  const rl = await enforceRateLimit({ bucket: "mfa", ip: userId, max: 10, windowMs: 15 * 60_000 });
  if (!rl.allowed) return { ok: false, error: "rate-limited" };

  try {
    const [row] = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
    if (!row || row.enabledAt) return { ok: false, error: "no-pending" };

    const secret = decryptSecret(row.secretEnc);
    const verdict = await verifyTotp(secret, code, null);
    if (!verdict.ok) return { ok: false, error: "invalid-code" };

    const recoveryCodes = generateRecoveryCodes(10);
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(userMfa)
        .set({ enabledAt: now, lastUsedStep: verdict.step })
        .where(eq(userMfa.userId, userId));
      // Reemplaza cualquier juego anterior (enrolamientos pendientes previos).
      await tx.delete(userMfaRecoveryCodes).where(eq(userMfaRecoveryCodes.userId, userId));
      await tx.insert(userMfaRecoveryCodes).values(
        recoveryCodes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) }))
      );
    });

    // Auditoría fire-safe (recordSecurityEvent captura sus propios errores).
    const { ip, userAgent } = await getRequestContext().catch(() => ({ ip: "unknown", userAgent: "" }));
    await recordSecurityEvent({ userId, type: "mfa_enrolled", ip, userAgent });

    return { ok: true, recoveryCodes };
  } catch (err) {
    console.error("[mfa] confirmMfaEnrollment failed:", err);
    return { ok: false, error: "unknown" };
  }
}

export type DisableMfaResult =
  | { ok: true }
  | {
      ok: false;
      error: "no-session" | "not-enabled" | "wrong-password" | "invalid-code" | "rate-limited" | "unknown";
    };

/**
 * Desactiva la 2FA con reautenticación completa: contraseña actual + un
 * TOTP vigente O un código de recuperación sin usar. Borra el secreto y
 * todos los códigos (volver a activar genera un juego nuevo).
 */
export async function disableMfa(password: string, code: string): Promise<DisableMfaResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "no-session" };

  const rl = await enforceRateLimit({ bucket: "mfa", ip: userId, max: 10, windowMs: 15 * 60_000 });
  if (!rl.allowed) return { ok: false, error: "rate-limited" };

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return { ok: false, error: "no-session" };

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) return { ok: false, error: "wrong-password" };

    const [row] = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
    if (!row?.enabledAt) return { ok: false, error: "not-enabled" };

    const trimmed = code.trim();
    let verified = false;
    if (isTotpFormat(trimmed)) {
      const secret = decryptSecret(row.secretEnc);
      const verdict = await verifyTotp(secret, trimmed, row.lastUsedStep);
      // No se persiste last_used_step: las filas se borran justo después.
      verified = verdict.ok;
    } else {
      const codeHash = hashRecoveryCode(trimmed);
      const [rc] = await db
        .select({ id: userMfaRecoveryCodes.id, usedAt: userMfaRecoveryCodes.usedAt })
        .from(userMfaRecoveryCodes)
        .where(
          and(
            eq(userMfaRecoveryCodes.userId, userId),
            eq(userMfaRecoveryCodes.codeHash, codeHash)
          )
        )
        .limit(1);
      verified = Boolean(rc && !rc.usedAt);
    }
    if (!verified) return { ok: false, error: "invalid-code" };

    await db.transaction(async (tx) => {
      await tx.delete(userMfaRecoveryCodes).where(eq(userMfaRecoveryCodes.userId, userId));
      await tx.delete(userMfa).where(eq(userMfa.userId, userId));
    });

    const { ip, userAgent } = await getRequestContext().catch(() => ({ ip: "unknown", userAgent: "" }));
    await recordSecurityEvent({ userId, type: "mfa_disabled", ip, userAgent });

    return { ok: true };
  } catch (err) {
    console.error("[mfa] disableMfa failed:", err);
    return { ok: false, error: "unknown" };
  }
}
