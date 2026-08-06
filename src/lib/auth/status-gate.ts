/**
 * Puerta de estado de cuenta del login (C-PR5) — la ejecuta `authorize()`
 * DESPUÉS de validar la contraseña y ANTES de la puerta MFA. Vive en su
 * propio módulo (mismo patrón que src/lib/mfa/login-gate.ts) para poder
 * testearla directamente: `config.ts` instancia NextAuth al importarse y no
 * se puede unit-testear sin arrastrar todo el runtime.
 *
 * Contrato: solo `status === 'active'` puede iniciar sesión. Cualquier otro
 * estado se rechaza con el MISMO resultado que unas credenciales inválidas
 * (authorize devuelve null → mensaje genérico): no se revela si la cuenta
 * está suspendida o pendiente de invitación. La auditoría es fire-safe —
 * registrar el evento jamás altera el veredicto.
 */

import { recordSecurityEvent } from "@/lib/security/events";

export type UserAccountStatus = "active" | "invited" | "suspended";

export async function enforceStatusGate(
  user: { id: string; status: UserAccountStatus },
  ctx: { ip?: string; userAgent?: string }
): Promise<"ok" | "rejected"> {
  if (user.status === "active") return "ok";

  try {
    await recordSecurityEvent({
      userId: user.id,
      type: "login_failed",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { reason: "status", status: user.status },
    });
  } catch (err) {
    console.error("[auth] login_failed(status) event error — ignoring:", err);
  }

  return "rejected";
}
