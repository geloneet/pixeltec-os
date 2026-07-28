/**
 * Mensajes públicos de las corridas IA de PixelForge (E0f-3b).
 *
 * `pixelforgeAiRuns.error` es a la vez columna persistida y texto user-facing:
 * el poller (`GET /api/pixelforge/runs/:runId`) lo devuelve tal cual y los
 * paneles lo muestran en toasts. Por eso el contrato es un mensaje fijo en
 * es-MX por `failureKind` — redactado por nosotros, jamás el `message` del SDK,
 * el cuerpo del proveedor ni los issues de Zod (que pueden citar valores de la
 * salida del modelo). La taxonomía (`failureKind`), tokens y duración se
 * conservan: la observabilidad vive ahí, no en texto libre.
 *
 * Módulo puro (solo importa el tipo de la taxonomía): lo comparten `run.ts`
 * (escritura) y `repos/pixelforge.ts` (lectura pública) sin ciclos.
 */
import type { PixelforgeRunFailure } from "./failures";

/** Mensaje público fijo por kind — Record exhaustivo: un kind nuevo sin mensaje rompe el typecheck. */
export const RUN_PUBLIC_MESSAGES: Record<PixelforgeRunFailure, string> = {
  refusal: "El modelo rechazó generar una respuesta para esta operación.",
  max_tokens: "La respuesta del modelo alcanzó el límite de tokens configurado antes de completarse.",
  schema_too_complex: "La operación excede la complejidad que el proveedor de IA acepta.",
  domain_validation: "La respuesta del modelo no cumple el formato esperado.",
  provider_error: "No fue posible completar la generación con el proveedor de IA.",
  timeout: "La generación con el proveedor de IA excedió el tiempo límite.",
};

export const EMPTY_TEXT_MESSAGE = "El modelo no devolvió ningún bloque de texto en la respuesta.";
export const INVALID_JSON_MESSAGE =
  "La respuesta del modelo no es JSON válido; la gramática de Structured Outputs debió garantizarlo.";
export const STOP_UNEXPECTED_MESSAGE = "El modelo detuvo la generación por un motivo inesperado.";

/**
 * Todo texto que este código (o el previo a E0f-3b) escribe legítimamente en
 * `pixelforgeAiRuns.error`: los mensajes por kind, los literales del pipeline,
 * el "Error inesperado" de los catches de `runs/route.ts` y los 4 literales de
 * los guards de advisory (`makeGuard` + su chequeo de QA en curso).
 */
const SAFE_RUN_ERROR_VALUES: ReadonlySet<string> = new Set([
  ...Object.values(RUN_PUBLIC_MESSAGES),
  EMPTY_TEXT_MESSAGE,
  INVALID_JSON_MESSAGE,
  STOP_UNEXPECTED_MESSAGE,
  "Error inesperado",
  "No hay un QA en curso para este proyecto",
  "La crítica de diseño IA ya se lanzó para este QA",
  "El score de originalidad IA ya se lanzó para este QA",
  "La detección de semejanza IA ya se lanzó para este QA",
]);

/**
 * Saneamiento en lectura para filas históricas: corridas anteriores a E0f-3b
 * persistieron el `message` crudo del SDK o el texto de Zod. La fila no se
 * muta (la limpieza física es un gate posterior al snapshot); lo desconocido
 * se sustituye por el mensaje público de `provider_error` al servir el shape
 * público.
 */
export function sanitizeRunErrorForPublic(error: string | null): string | null {
  if (error === null) return null;
  return SAFE_RUN_ERROR_VALUES.has(error) ? error : RUN_PUBLIC_MESSAGES.provider_error;
}
