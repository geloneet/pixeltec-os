/**
 * Propagación de errores del subsistema WhatsApp Inbox.
 *
 * Hermano de `@/lib/ai/errors`, con el mismo principio —el `message` de un
 * error desconocido se descarta sin mirarlo— y dos añadidos que aquel no
 * necesita:
 *
 *  1. **Vocabulario de fallos de PixelBot.** Un servicio HTTP propio falla de
 *     formas que un SDK de IA no tiene: redirect inesperado, respuesta que no
 *     es JSON, upstream caído.
 *
 *  2. **Mapeo de status.** En Growth todo sale 500 porque el fallo siempre es
 *     nuestro. Aquí hay un tercero de por medio, y confundir «PixelBot rechazó
 *     tu entrada» con «PixelBot está caído» le cuesta al admin media hora de
 *     diagnóstico.
 *
 * Lo que **no** cruza nunca: el cuerpo de la respuesta de PixelBot. Antes de
 * este módulo, un 500 de FastAPI con stack trace llegaba íntegro al navegador
 * sin pasar por ningún `catch`, porque el cliente no miraba `res.ok`.
 */

import { SafeUserError } from "@/lib/ai/errors";
import { EgressBlockedError } from "@/lib/egress-guard";

/**
 * Códigos estables. Son la única señal que los consumidores deben leer; el
 * texto del mensaje es para humanos y puede cambiar.
 */
export type PixelbotErrorCode =
  /** Faltan `PIXELBOT_INTERNAL_URL` / `PIXELBOT_INTERNAL_SECRET`. */
  | "pixelbot_not_configured"
  /** La ruta no está en la tabla de rutas conocidas, o tiene forma sospechosa. */
  | "pixelbot_path_rejected"
  /** Se agotaron los 15 s de `AbortSignal.timeout`. */
  | "pixelbot_timeout"
  /** Fallo de red: DNS, conexión rechazada, TLS. */
  | "pixelbot_unreachable"
  /** PixelBot respondió 3xx. No se sigue: el secreto viajaría al host nuevo. */
  | "pixelbot_redirect_blocked"
  /** La respuesta no era JSON (típicamente un 502 HTML de nginx). */
  | "pixelbot_invalid_response"
  /** PixelBot respondió con un código de error. Su cuerpo no se lee. */
  | "pixelbot_upstream";

export class PixelbotError extends Error {
  readonly code: PixelbotErrorCode;
  readonly status?: number;

  constructor(input: { code: PixelbotErrorCode; status?: number }) {
    super(
      `PIXELBOT_ERROR: ${input.code}` +
        `${input.status !== undefined ? ` (status ${input.status})` : ""}`
    );
    this.name = "PixelbotError";
    this.code = input.code;
    this.status = input.status;
    // Restaura la cadena de prototipos: un target < ES2015 rompe `instanceof`
    // sobre clases de Error nativas (mismo motivo que `AiProviderError`).
    Object.setPrototypeOf(this, PixelbotError.prototype);
  }
}

/**
 * Representación mínima que puede cruzar hacia el navegador: un código estable,
 * un mensaje que ya era nuestro antes de llegar aquí, y el status HTTP con el
 * que responder.
 */
export type InboxFailure = {
  code: string;
  message: string;
  status: number;
};

/**
 * Status con el que sale cada fallo de PixelBot.
 *
 * `pixelbot_upstream` no aparece porque su status depende del que devolvió
 * PixelBot, y se resuelve aparte.
 */
const STATUS_POR_CODIGO: Record<Exclude<PixelbotErrorCode, "pixelbot_upstream">, number> = {
  pixelbot_not_configured: 503,
  // Es un fallo nuestro —una ruta que el cliente construyó mal—, no del upstream.
  pixelbot_path_rejected: 500,
  pixelbot_timeout: 504,
  pixelbot_unreachable: 502,
  pixelbot_redirect_blocked: 502,
  pixelbot_invalid_response: 502,
};

/**
 * Traduce cualquier error a una `InboxFailure`.
 *
 * El `message` de un error desconocido **se descarta sin mirarlo**: no se
 * inspecciona, no se trunca y no se registra. Truncar o filtrar por patrones
 * seguiría dejando pasar el primer fragmento, que es justo donde un ORM pone el
 * SQL y un framework el eco del cuerpo.
 *
 * `EgressBlockedError` se distingue del fallo de servicio a propósito: que una
 * llamada no saliera por política y que saliera y fallara son sucesos distintos,
 * y confundirlos esconde una configuración incompleta tras un «error de red».
 */
export function toInboxFailure(err: unknown, fallbackMessage: string): InboxFailure {
  if (err instanceof EgressBlockedError) {
    return { code: "egress_blocked", message: fallbackMessage, status: 503 };
  }

  if (err instanceof PixelbotError) {
    if (err.code === "pixelbot_upstream") {
      // Un 4xx es accionable por quien llama y se conserva. Un 5xx del upstream
      // no es un fallo de esta API: sale como 502, no como 500.
      const status = err.status ?? 502;
      return {
        code: err.code,
        message: fallbackMessage,
        status: status >= 400 && status < 500 ? status : 502,
      };
    }
    return { code: err.code, message: fallbackMessage, status: STATUS_POR_CODIGO[err.code] };
  }

  // Mensaje redactado por nosotros: es el único caso en que el texto del error
  // sí puede mostrarse.
  if (err instanceof SafeUserError) {
    return { code: err.code, message: err.message, status: 400 };
  }

  return { code: "internal_error", message: fallbackMessage, status: 500 };
}

/**
 * Lee el cuerpo JSON de una petición sin dejar que su fallo se confunda con un
 * error de servidor.
 *
 * Antes, `await req.json()` vivía dentro del `try` principal de cada ruta: un
 * cuerpo malformado salía como 500 y arrastraba el `SyntaxError` de V8, que
 * incluye un fragmento del propio cuerpo. Ahora sale como 400 y sin eco.
 */
export async function parseJsonBody<T>(req: {
  json: () => Promise<unknown>;
}): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: (await req.json()) as T };
  } catch {
    return { ok: false };
  }
}
