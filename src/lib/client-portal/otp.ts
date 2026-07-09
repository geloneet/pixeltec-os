import crypto from "node:crypto";

/** Código de acceso de 6 dígitos, con ceros a la izquierda si aplica. */
export function generateAccessCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Hash HMAC del código — nunca se guarda el código en texto plano. */
export function hashAccessCode(code: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}

/** Comparación en tiempo constante del hash guardado contra un código candidato. */
export function accessCodeMatches(storedHash: string, code: string, secret: string): boolean {
  const providedHash = hashAccessCode(code, secret);
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(providedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
