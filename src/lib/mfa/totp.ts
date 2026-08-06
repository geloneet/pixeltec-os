/**
 * Primitivas TOTP y de códigos de recuperación (C-PR4) — funciones puras y
 * testeables, sin DB. La orquestación con `user_mfa` vive en login-gate.ts
 * y actions.ts.
 *
 * otplib v13 (API funcional — v12 y su `authenticator` ya no existen):
 * `verify()` devuelve `{ valid, delta, timeStep }`; `timeStep` es el paso de
 * tiempo donde el token coincidió, que es exactamente lo que persiste el
 * anti-replay en `user_mfa.last_used_step`.
 */

import { createHash, randomBytes } from "node:crypto";
import { verify } from "otplib";

/** Periodo TOTP estándar (Google Authenticator). */
export const TOTP_PERIOD_S = 30;

/**
 * Tolerancia en segundos = ±1 periodo → "ventana 1": se acepta el token del
 * paso actual, el anterior y el siguiente (deriva de reloj razonable).
 */
export const TOTP_EPOCH_TOLERANCE_S = 30;

/** Un TOTP son exactamente 6 dígitos; cualquier otra cosa se trata como código de recuperación. */
export function isTotpFormat(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/** Normaliza un código de recuperación: mayúsculas, sin espacios ni guiones. */
export function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, "");
}

/** sha256 hex del código normalizado — lo único que toca la DB. */
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

/** Alfabeto base32 (RFC 4648) — legible y compatible con lo que teclea un humano. */
const RECOVERY_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Genera `count` códigos de recuperación de 10 caracteres base32. */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(10);
    let code = "";
    for (let i = 0; i < 10; i++) {
      code += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
    }
    return code;
  });
}

export type TotpVerdict = { ok: true; step: number } | { ok: false };

/**
 * Verifica un TOTP con ventana ±1 y anti-replay: el paso donde coincidió el
 * token debe ser ESTRICTAMENTE mayor que `lastUsedStep` (un token ya usado —
 * o uno más viejo — se rechaza aunque criptográficamente valide). `epoch`
 * (segundos unix) es inyectable para tests deterministas.
 */
export async function verifyTotp(
  secret: string,
  token: string,
  lastUsedStep: number | null,
  epoch?: number
): Promise<TotpVerdict> {
  const result = await verify({
    secret,
    token: token.trim(),
    epochTolerance: TOTP_EPOCH_TOLERANCE_S,
    ...(epoch !== undefined ? { epoch } : {}),
  });
  if (!result.valid) return { ok: false };
  // El tipo de otplib une TOTP|HOTP y solo el resultado TOTP trae timeStep;
  // aquí siempre es TOTP (estrategia por defecto), pero se narra el tipo.
  if (!("timeStep" in result)) return { ok: false };
  const step = result.timeStep;
  if (lastUsedStep !== null && step <= lastUsedStep) return { ok: false };
  return { ok: true, step };
}
