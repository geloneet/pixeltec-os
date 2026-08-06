/**
 * Helpers de tokens de invitación (C-PR5) — compartidos por las actions de
 * administración (emitir/reenviar) y por el flujo público de aceptación
 * (/invitacion/[token]). Mismo principio que el reset de contraseña: el token
 * crudo (crypto.randomBytes(32) hex) solo viaja en el enlace del correo;
 * a la base únicamente llega su sha256.
 */

import crypto from "node:crypto";

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
export const INVITATION_TTL_LABEL = "7 días";

export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashInvitationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
