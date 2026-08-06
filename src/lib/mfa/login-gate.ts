/**
 * Puerta MFA del login (C-PR4) — la llama `authorize()` DESPUÉS de validar
 * la contraseña. Separada de config.ts para poder testearla con mocks sin
 * arrastrar NextAuth completo.
 *
 * Contratos de fallo:
 * - Lectura de `user_mfa` fallida (tabla 0033 sin aplicar, DB caída):
 *   FAIL-OPEN como "no-mfa" con console.error — si la tabla no existe, nadie
 *   pudo haber enrolado 2FA, y un outage no debe bloquear el login por una
 *   capa que el usuario quizá ni activó. La contraseña YA fue validada.
 * - Escritura de `last_used_step` fallida tras un TOTP válido: FAIL-CLOSED
 *   ("failed") — sin persistir el paso no hay garantía anti-replay, y a ese
 *   punto la DB acaba de responder una lectura, así que un fallo aquí es
 *   excepcional de verdad.
 * - `MFA_ENCRYPTION_KEY` ausente/ inválida con MFA activa: "failed" con
 *   console.error accionable (recuperación: break-glass documentado en la
 *   migración 0033).
 */

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { userMfa, userMfaRecoveryCodes } from "@/lib/db/schema";
import { recordSecurityEvent } from "@/lib/security/events";
import { decryptSecret } from "./crypto";
import { hashRecoveryCode, isTotpFormat, verifyTotp } from "./totp";

export type MfaGateResult = "no-mfa" | "ok" | "required" | "failed";

export async function enforceMfaGate(
  userId: string,
  totpInput: string | undefined,
  ctx?: { ip?: string; userAgent?: string }
): Promise<MfaGateResult> {
  let row: typeof userMfa.$inferSelect | undefined;
  try {
    [row] = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
  } catch (err) {
    // Fail-open documentado en la cabecera: tabla 0033 sin aplicar ⇒ nadie
    // tiene 2FA todavía; el login (con contraseña ya validada) sigue.
    console.error("[mfa] user_mfa read failed — treating as no-mfa:", err);
    return "no-mfa";
  }

  if (!row?.enabledAt) return "no-mfa";

  const code = totpInput?.trim();
  if (!code) return "required";

  if (isTotpFormat(code)) {
    let secret: string;
    try {
      secret = decryptSecret(row.secretEnc);
    } catch (err) {
      console.error("[mfa] no se pudo descifrar el secreto TOTP (¿MFA_ENCRYPTION_KEY ausente o rotada?):", err);
      return "failed";
    }
    const verdict = await verifyTotp(secret, code, row.lastUsedStep);
    if (!verdict.ok) return "failed";
    try {
      await db
        .update(userMfa)
        .set({ lastUsedStep: verdict.step })
        .where(eq(userMfa.userId, userId));
    } catch (err) {
      // Fail-closed: sin persistir el paso no hay anti-replay (cabecera).
      console.error("[mfa] last_used_step write failed — failing CLOSED:", err);
      return "failed";
    }
    return "ok";
  }

  // Formato no-TOTP ⇒ se intenta como código de recuperación (hash sin usar).
  try {
    const codeHash = hashRecoveryCode(code);
    const [rc] = await db
      .select({ id: userMfaRecoveryCodes.id })
      .from(userMfaRecoveryCodes)
      .where(
        and(
          eq(userMfaRecoveryCodes.userId, userId),
          eq(userMfaRecoveryCodes.codeHash, codeHash),
          isNull(userMfaRecoveryCodes.usedAt)
        )
      )
      .limit(1);
    if (!rc) return "failed";

    // Se quema ANTES de conceder el acceso: un código de recuperación es de
    // un solo uso incluso si algo posterior falla.
    await db
      .update(userMfaRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(eq(userMfaRecoveryCodes.id, rc.id));

    await recordSecurityEvent({
      userId,
      type: "mfa_recovery_used",
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });
    return "ok";
  } catch (err) {
    console.error("[mfa] recovery-code check failed — failing CLOSED:", err);
    return "failed";
  }
}
