/**
 * Cliente server-side hacia la API interna de PixelBot.
 *
 * PixelBot corre como container `pixelbot` en la red Docker `web-network`
 * (misma red que este app). En producción PIXELBOT_INTERNAL_URL es
 * http://pixelbot:3011; en dev local (el VPS mismo) http://127.0.0.1:3011.
 *
 * Solo usar desde API routes / server actions — el secret jamás llega al browser.
 *
 * Este es el **único punto de salida** hacia PixelBot: ningún otro módulo lee
 * `PIXELBOT_INTERNAL_URL` ni `PIXELBOT_INTERNAL_SECRET`. Por eso la política de
 * egress vive aquí y no repartida por las 14 rutas que lo consumen.
 */

import { assertInternalEgressAllowed } from "@/lib/egress-guard";
import { PixelbotError } from "./errors";
import { classifyPixelbotPath, type PixelbotMethod } from "./pixelbot-paths";

/** Identidad del servicio dentro de `EGRESS_INTERNAL_TARGET_ALLOWLIST`. */
const PIXELBOT_SERVICE = "pixelbot";

const TIMEOUT_MS = 15_000;

/** ¿El fallo de `fetch` fue por agotar el tiempo, o por no poder conectar? */
function esTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.name === "AbortError";
}

export async function fetchPixelbot(
  path: string,
  body?: Record<string, unknown>,
  method: PixelbotMethod = "POST"
): Promise<{ data: unknown; status: number }> {
  const baseUrl = process.env.PIXELBOT_INTERNAL_URL;
  if (!baseUrl) {
    // Antes esto era un `new Error` cuyo texto —los nombres de las dos
    // variables— acababa concatenado en una respuesta HTTP.
    throw new PixelbotError({ code: "pixelbot_not_configured" });
  }

  // Lo desconocido no sale. La ruta decide además el permiso: leer la
  // configuración y enviar un WhatsApp real no pasan por la misma puerta.
  const operation = classifyPixelbotPath(path, method);
  if (operation === null) {
    throw new PixelbotError({ code: "pixelbot_path_rejected" });
  }

  assertInternalEgressAllowed({ service: PIXELBOT_SERVICE, rawUrl: baseUrl, operation });

  // El secreto se lee SOLO cuando la política ya autorizó la llamada. Leerlo
  // antes no filtraba nada por sí mismo, pero dejaba el valor en el frame de
  // caminos que terminan bloqueados, y hacía que un secreto ausente
  // enmascarara un fallo de política tras un «no configurado».
  const secret = process.env.PIXELBOT_INTERNAL_SECRET;
  if (!secret) {
    throw new PixelbotError({ code: "pixelbot_not_configured" });
  }

  const headers: Record<string, string> = {
    "X-Internal-Secret": secret,
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
    cache: "no-store",
    // Un redirect no se sigue jamás. En un salto cross-origin la spec de fetch
    // solo elimina `Authorization`, `Cookie` y `Proxy-Authorization`: una
    // cabecera propia como `X-Internal-Secret` viajaría íntegra al host nuevo.
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };

  // GET requests don't include body or Content-Type
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body || {});
  }

  // La concatenación es deliberada: `new URL(path, baseUrl)` resolvería un
  // `path` que empiece por `//host` contra otro servidor. No sustituir.
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, fetchOptions);
  } catch (error) {
    // El error de undici cita host y puerto en `cause`; no se propaga nada de él.
    throw new PixelbotError({
      code: esTimeout(error) ? "pixelbot_timeout" : "pixelbot_unreachable",
    });
  }

  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    throw new PixelbotError({ code: "pixelbot_redirect_blocked", status: res.status });
  }

  if (!res.ok) {
    // El cuerpo **no se lee**: un 500 de FastAPI trae stack trace, rutas de
    // archivo y a veces el eco del payload, y antes de esto se reenviaba
    // íntegro al navegador sin pasar por ningún `catch`.
    throw new PixelbotError({ code: "pixelbot_upstream", status: res.status });
  }

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    // Un 502 HTML de nginx se convertía antes en `{}`, indistinguible de una
    // respuesta vacía legítima de PixelBot.
    throw new PixelbotError({ code: "pixelbot_invalid_response", status: res.status });
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new PixelbotError({ code: "pixelbot_invalid_response", status: res.status });
  }

  return { data, status: res.status };
}
