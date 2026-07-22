/**
 * Token HMAC-SHA256 efímero de preview de QA (`?pfqa=`) — permite al
 * qa-runner (T6, contenedor Playwright en red interna, SIN sesión de
 * usuario) cargar `/proyectos/pixelforge/[id]/preview` sobre una versión
 * EXACTA (no "la vigente"). Mismo patrón que
 * `src/lib/client-portal/session-token.ts` (HMAC + `timingSafeEqual`), con
 * un payload más ancho: la identidad completa de ownership viaja EN el
 * token, firmada por quien encoló el QA — así la rama `pfqa` de la página
 * hereda esa identidad sin abrir superficie IDOR nueva (nunca se mezcla con
 * la sesión del usuario que esté mirando el navegador en ese momento).
 *
 * Formato: `base64url(JSON-del-payload).base64url(firma)`. La firma es el
 * HMAC-SHA256 sobre los BYTES exactos de `base64url(JSON-del-payload)`
 * (igual que `session-token.ts`) — `verify` nunca reconstruye el JSON antes
 * de comprobar la firma, solo después (para leer el shape).
 *
 * Orden CANÓNICO de claves del JSON firmado (fijo, no depende de cómo el
 * caller haya escrito el objeto literal): `qaRunId`, `projectId`,
 * `pageVersionId`, `ownerId`, `exp`. `signQaPreviewToken` siempre serializa
 * en este orden — dos payloads con el mismo contenido pero distinto orden de
 * inserción producen el mismo token.
 *
 * `exp` es epoch SEGUNDOS (a diferencia de `session-token.ts`, que usa ms) —
 * el TTL lo decide quien firma; el qa-runner firma con `claim + 10 min`
 * (T6). `verify` recibe `now` como PARÁMETRO explícito (testeabilidad): el
 * caller pasa `Math.floor(Date.now() / 1000)`, nunca `Date.now()` interno.
 */
import crypto from "node:crypto";

export interface QaPreviewTokenPayload {
  qaRunId: string;
  projectId: string;
  pageVersionId: string;
  ownerId: string;
  exp: number;
}

/** Serializa el payload en el orden CANÓNICO documentado arriba. */
function canonicalPayloadJson(payload: QaPreviewTokenPayload): string {
  return JSON.stringify({
    qaRunId: payload.qaRunId,
    projectId: payload.projectId,
    pageVersionId: payload.pageVersionId,
    ownerId: payload.ownerId,
    exp: payload.exp,
  });
}

function sign(payloadB64: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

/** Firma el payload como `<payload-b64url>.<firma-b64url>`. */
export function signQaPreviewToken(payload: QaPreviewTokenPayload, secret: string): string {
  const payloadB64 = Buffer.from(canonicalPayloadJson(payload), "utf-8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

function isQaPreviewTokenPayload(value: unknown): value is QaPreviewTokenPayload {
  if (value === null || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.qaRunId === "string" &&
    typeof p.projectId === "string" &&
    typeof p.pageVersionId === "string" &&
    typeof p.ownerId === "string" &&
    typeof p.exp === "number"
  );
}

/**
 * Verifica firma + shape + expiración. Nunca lanza: formato inválido, base64
 * corrupto, JSON inválido, shape incompleto/con tipos incorrectos, firma
 * incorrecta o `exp <= now` devuelven `null` — jamás una excepción que
 * pudiera tumbar la ruta que lo llama.
 */
export function verifyQaPreviewToken(
  token: string,
  secret: string,
  nowEpochSeconds: number
): QaPreviewTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return null;

  // Firma sobre los bytes EXACTOS transmitidos (`payloadB64` crudo) — nunca
  // sobre una reconstrucción posterior al parseo.
  const expectedSignature = sign(payloadB64, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  // Longitudes iguales ANTES de comparar: `timingSafeEqual` lanza si difieren
  // (un atacante podría usar eso como oráculo), así que el `length` check es
  // la guarda, no una optimización.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  if (!isQaPreviewTokenPayload(payload)) return null;
  if (payload.exp <= nowEpochSeconds) return null;

  return payload;
}
