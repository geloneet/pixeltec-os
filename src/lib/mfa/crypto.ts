/**
 * Cifrado del secreto TOTP (C-PR4) — AES-256-GCM con el `crypto` nativo de
 * Node. El secreto jamás se guarda en claro: `user_mfa.secret_enc` contiene
 * `iv:tag:ct` en base64. La clave vive en `MFA_ENCRYPTION_KEY` (32 bytes en
 * base64, p. ej. `openssl rand -base64 32`).
 *
 * Contrato de fallo: la ausencia de la clave NO tumba el arranque de la app
 * — este módulo solo lanza (con mensaje accionable) cuando alguien intenta
 * cifrar/descifrar, es decir, al ENROLAR o al validar un login con MFA ya
 * activa. Mientras nadie use 2FA, la env puede no existir.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Prefijo estable para detectar este fallo concreto en los callers. */
export const MFA_KEY_ERROR = "MFA_ENCRYPTION_KEY";

function getKey(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      `${MFA_KEY_ERROR} no está configurada. Genera 32 bytes con \`openssl rand -base64 32\` ` +
        "y añádela al entorno antes de enrolar la verificación en dos pasos."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `${MFA_KEY_ERROR} inválida: deben ser exactamente 32 bytes en base64 ` +
        `(la actual decodifica a ${key.length} bytes).`
    );
  }
  return key;
}

/** Cifra un secreto TOTP → `iv:tag:ct` (cada parte en base64). */
export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96 bits — tamaño recomendado para GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Descifra `iv:tag:ct`. Lanza si el formato o el tag GCM no validan. */
export function decryptSecret(enc: string): string {
  const key = getKey();
  const parts = enc.split(":");
  if (parts.length !== 3) {
    throw new Error("secret_enc con formato inválido — se esperaba iv:tag:ct en base64");
  }
  const [iv, tag, ct] = parts.map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
