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

import type { AiOperation, AiProvider } from "@/lib/egress-guard";

/**
 * Códigos estables. Son la única señal que los consumidores deben leer para
 * clasificar un fallo; el texto del mensaje es para humanos y puede cambiar.
 */
export type AiProviderErrorCode =
  /** Timeout o abort de conexión. */
  | "ai_timeout"
  /** El proveedor rechazó la gramática / `output_config` (schema demasiado complejo). */
  | "ai_schema_rejected"
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
