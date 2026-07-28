/**
 * Error saneado de un proveedor de IA.
 *
 * Vive aparte del adaptador (`./anthropic-egress`) a propósito: módulos de
 * lógica pura —como la taxonomía de fallos de PixelForge— necesitan
 * reconocerlo sin arrastrar el SDK ni el código que instancia clientes.
 *
 * Lo que transporta es estructura, no contenido: proveedor, operación, un
 * `code` estable y, si el proveedor lo dio, el `status` HTTP. Nunca el prompt,
 * el system prompt, la respuesta, la clave, el cuerpo crudo del proveedor ni el
 * modelo — el mensaje del SDK puede citar cualquiera de esos, y de ahí acaba en
 * logs y trazas.
 */

import { EgressBlockedError, type AiOperation, type AiProvider } from "@/lib/egress-guard";

/**
 * Códigos estables. Son la única señal que los consumidores deben leer para
 * clasificar un fallo; el texto del mensaje es para humanos y puede cambiar.
 */
export type AiProviderErrorCode =
  /** Timeout o abort de conexión. */
  | "ai_timeout"
  /** El proveedor rechazó la gramática / `output_config` (schema demasiado complejo). */
  | "ai_schema_rejected"
  /** El proveedor respondió 3xx. No se sigue: la credencial viajaría al host nuevo. */
  | "ai_redirect_blocked"
  /** Cualquier otro fallo del proveedor. */
  | "ai_provider_error"
  /** Falta la credencial del proveedor: no se llegó a construir cliente. */
  | "ai_not_configured";

export class AiProviderError extends Error {
  readonly provider: AiProvider;
  readonly operation: AiOperation;
  readonly code: AiProviderErrorCode;
  readonly status?: number;

  constructor(input: {
    provider: AiProvider;
    operation: AiOperation;
    code: AiProviderErrorCode;
    status?: number;
  }) {
    super(
      `AI_PROVIDER_ERROR: ${input.provider}/${input.operation} (${input.code}` +
        `${input.status !== undefined ? `, status ${input.status}` : ""})`
    );
    this.name = "AiProviderError";
    this.provider = input.provider;
    this.operation = input.operation;
    this.code = input.code;
    this.status = input.status;
    // Restaura la cadena de prototipos (mismo motivo que `PixelforgeRunError`:
    // un target < ES2015 rompe `instanceof` sobre clases de Error nativas).
    Object.setPrototypeOf(this, AiProviderError.prototype);
  }
}

/**
 * Error cuyo mensaje lo redactamos nosotros y es seguro mostrar y persistir.
 *
 * Existe para poder distinguir en runtime lo que escribimos —«Créditos
 * insuficientes», «Marca no encontrada»— de lo que trae un tercero. Un
 * `new Error(...)` de la app y un `APIError` de un SDK son indistinguibles al
 * capturarlos, y esa ambigüedad es justo la que hacía que el cuerpo crudo de un
 * proveedor acabara en `growth_jobs.error` y en una respuesta HTTP.
 *
 * Regla al construirlo: el mensaje debe ser literal nuestro. Interpolar cifras
 * propias (saldos, cantidades) es correcto; interpolar `err.message`,
 * `res.text()` o cualquier dato que venga de fuera lo convierte en una fuga con
 * otro nombre.
 */
export class SafeUserError extends Error {
  readonly code: string;

  constructor(message: string, code = "operation_failed") {
    super(message);
    this.name = "SafeUserError";
    this.code = code;
    Object.setPrototypeOf(this, SafeUserError.prototype);
  }
}

/**
 * Representación mínima que puede cruzar hacia el usuario, la base de datos o
 * un log: un código estable y un mensaje que ya era seguro antes de llegar aquí.
 */
export type SafeFailure = {
  /** Etiqueta estable para clasificar. Nunca contiene texto de terceros. */
  code: string;
  /** Mensaje redactado por nosotros. Nunca es el `message` de un desconocido. */
  message: string;
  /** Status HTTP del proveedor, si lo hubo. Es un número, no transporta texto. */
  status?: number;
};

/**
 * Traduce cualquier error a una `SafeFailure`.
 *
 * El `message` de un error desconocido **se descarta sin mirarlo**: no se
 * inspecciona, no se trunca y no se registra. Truncar o filtrar por patrones
 * seguiría dejando pasar el primer fragmento, que es exactamente donde los SDK
 * colocan el eco del prompt o del cuerpo de la respuesta.
 *
 * `EgressBlockedError` se distingue del fallo de proveedor a propósito: que una
 * llamada no saliera por política y que saliera y fallara son sucesos distintos,
 * y confundirlos oculta una configuración incompleta detrás de un «error de IA».
 */
export function toSafeFailure(err: unknown, fallbackMessage: string): SafeFailure {
  if (err instanceof EgressBlockedError) {
    return { code: "ai_egress_blocked", message: fallbackMessage };
  }
  if (err instanceof AiProviderError) {
    return { code: err.code, message: fallbackMessage, status: err.status };
  }
  if (err instanceof SafeUserError) {
    return { code: err.code, message: err.message };
  }
  return { code: "internal_error", message: fallbackMessage };
}
