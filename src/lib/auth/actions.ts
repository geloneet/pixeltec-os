"use server";

import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { sendPasswordChangedEmail } from "@/lib/email";
import { enforceRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security/events";
import { logSystemAlert } from "@/lib/system-alerts";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:9002";

export type ChangePasswordResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "no-session"
        | "wrong-password"
        | "too-short"
        | "weak"
        | "mismatch"
        | "rate-limited"
        | "unknown";
    };

/**
 * Validación de la nueva contraseña (C-PR2): presencia, confirmación,
 * mínimo 8 y al menos 1 letra + 1 número. El orden de los `superRefine`
 * importa: el primer código emitido es el que se devuelve al cliente.
 */
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(1),
    confirmPassword: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "mismatch", path: ["confirmPassword"] });
      return;
    }
    if (data.newPassword.length < 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "too-short", path: ["newPassword"] });
      return;
    }
    if (!/[a-zA-Z]/.test(data.newPassword) || !/[0-9]/.test(data.newPassword)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "weak", path: ["newPassword"] });
    }
  });

function mapValidationError(error: z.ZodError): ChangePasswordResult {
  const codes = new Set(error.issues.map((i) => i.message));
  if (codes.has("mismatch")) return { ok: false, error: "mismatch" };
  if (codes.has("too-short")) return { ok: false, error: "too-short" };
  if (codes.has("weak")) return { ok: false, error: "weak" };
  return { ok: false, error: "unknown" };
}

async function getRequestContext(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    h.get("x-real-ip") ??
    "unknown";
  const userAgent = h.get("user-agent") ?? "";
  return { ip, userAgent };
}

/**
 * Cambia la contraseña del usuario autenticado (reemplaza el flujo de
 * Firebase `reauthenticateWithCredential` + `updatePassword` — Fase 2 de la
 * migración). C-PR2: valida con zod (confirmación + fortaleza mínima),
 * rate-limit por usuario (5 intentos / 15 min), y en la MISMA transacción
 * actualiza el hash e invalida los tokens de reset pendientes. Después —
 * fire-safe, jamás revierte el cambio ya hecho — registra el evento
 * `password_changed` y envía el aviso por correo.
 */
export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<ChangePasswordResult> {
  const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
  if (!parsed.success) return mapValidationError(parsed.error);

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "no-session" };

  // Rate-limit por usuario (no por IP): la clave del bucket es el userId —
  // frena a quien ya tiene una sesión e intenta adivinar la contraseña
  // actual, sin importar desde cuántas IPs lo haga.
  const rl = await enforceRateLimit({
    bucket: "change_password",
    ip: userId,
    max: 5,
    windowMs: 15 * 60_000,
  });
  if (!rl.allowed) return { ok: false, error: "rate-limited" };

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { ok: false, error: "no-session" };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "wrong-password" };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const changedAt = new Date();

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: changedAt })
        .where(eq(users.id, userId));
      // Invalida cualquier reset pendiente: un enlace de "¿olvidaste tu
      // contraseña?" emitido antes del cambio ya no debe poder usarse.
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: changedAt })
        .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
    });
  } catch (err) {
    console.error("[change-password] transaction failed:", err);
    return { ok: false, error: "unknown" };
  }

  // ── Post-cambio: auditoría + aviso. Fire-safe — la contraseña YA cambió;
  // nada de lo que sigue puede convertir el resultado en error. ──
  const { ip, userAgent } = await getRequestContext().catch(() => ({ ip: "unknown", userAgent: "" }));

  await recordSecurityEvent({ userId, type: "password_changed", ip, userAgent });

  try {
    const result = await sendPasswordChangedEmail({
      email: user.email,
      name: user.name,
      changedAt,
      loginUrl: `${APP_URL}/login`,
    });
    if (!result.success) {
      console.error("[change-password] sendPasswordChangedEmail failed:", result.error);
      await logSystemAlert({
        severity: "warning",
        source: "password_change",
        message: `Envío de aviso de cambio de contraseña falló para ${userId}`,
        context: { error: result.error },
      });
    }
  } catch (err) {
    console.error("[change-password] password-changed notice error — ignoring:", err);
  }

  return { ok: true };
}
