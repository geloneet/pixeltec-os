import crypto from "node:crypto";

export interface PortalSessionPayload {
  clientId: string;
  exp: number;
}

function sign(payloadB64: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

/** Firma un payload de sesión de portal como `<payload-b64url>.<firma-b64url>`. */
export function signPortalSessionToken(payload: PortalSessionPayload, secret: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

/** Verifica firma + expiración. `now` se pasa explícito (no `Date.now()` interno) para poder testear determinísticamente. */
export function verifyPortalSessionToken(token: string, secret: string, now: number): PortalSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expectedSignature = sign(payloadB64, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: PortalSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  if (payload === null || typeof payload !== "object") return null;
  if (typeof payload.clientId !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp <= now) return null;
  return payload;
}
