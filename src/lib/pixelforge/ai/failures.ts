/**
 * Taxonomía de fallos del motor IA de PixelForge — lógica pura (sin
 * `"server-only"`, sin cliente), testeable de forma aislada.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export type PixelforgeRunFailure =
  | "refusal"
  | "max_tokens"
  | "schema_too_complex"
  | "domain_validation"
  | "provider_error"
  | "timeout";

/** Error tipado de una corrida IA — kind es la taxonomía, retryable documenta si `ai/run.ts` reintenta ese kind (hoy solo domain_validation, vía 1 retry semántico). */
export class PixelforgeRunError extends Error {
  readonly kind: PixelforgeRunFailure;
  readonly retryable: boolean;

  constructor(kind: PixelforgeRunFailure, message: string) {
    super(message);
    this.name = "PixelforgeRunError";
    this.kind = kind;
    this.retryable = kind === "domain_validation";
    // Restaura la cadena de prototipos (TS target < ES2015 rompe `instanceof` sobre clases de Error nativas transpiladas).
    Object.setPrototypeOf(this, PixelforgeRunError.prototype);
  }
}

/** stop_reason de `messages.parse` → kind de fallo, o null si NO es un fallo (hay que seguir leyendo la respuesta). */
export function classifyStopReason(stopReason: string | null): PixelforgeRunFailure | null {
  if (stopReason === "refusal") return "refusal";
  if (stopReason === "max_tokens") return "max_tokens";
  return null;
}

const SCHEMA_ISSUE_PATTERN = /schema|grammar|output_config|format/i;

function hasName(err: unknown, name: string): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === name;
}

/**
 * Timeout / abort de conexión. NO nos apoyamos solo en `instanceof`: los
 * mocks de test pueden ser shapes planos (`{ name: "AbortError" }`) que no
 * pasan por la cadena de prototipos real del SDK.
 */
function isTimeoutLike(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return true;
  return hasName(err, "AbortError") || hasName(err, "APIConnectionTimeoutError");
}

/** APIError/APIConnectionError del SDK, o un shape duck-typed equivalente (mocks de test). */
function isAPIErrorLike(err: unknown): err is { status?: unknown; message?: unknown } {
  if (err instanceof Anthropic.APIError) return true;
  return typeof err === "object" && err !== null && "status" in err;
}

/**
 * `ZodError`, de CUALQUIER versión de Zod (v3 clásico, usado en la mayoría
 * del repo, o v4, usado en `src/lib/pixelforge/schemas/` por requisito de
 * `zodOutputFormat` — ver `../schemas/index.ts`). Ambas versiones nombran la
 * instancia `"ZodError"` con un array `issues`, así que duck-typing por
 * forma cubre las dos sin acoplar `failures.ts` a una versión específica.
 */
function isZodErrorLike(err: unknown): err is z.ZodError {
  if (err instanceof z.ZodError) return true;
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

/**
 * Clasifica un error capturado en `ai/run.ts` (try/catch alrededor de
 * `messages.parse`) en una `PixelforgeRunFailure`:
 * - `ZodError` → `domain_validation`.
 * - Timeout/abort → `timeout`.
 * - `APIError` con status 400 y mensaje relacionado a schema/grammar/output_config/format → `schema_too_complex`.
 * - Cualquier otro `APIError`/`APIConnectionError` → `provider_error`.
 * - Desconocido → `provider_error`.
 */
export function classifyError(err: unknown): PixelforgeRunFailure {
  if (isZodErrorLike(err)) return "domain_validation";
  if (isTimeoutLike(err)) return "timeout";
  if (isAPIErrorLike(err)) {
    const status = err.status;
    const message = typeof err.message === "string" ? err.message : "";
    if (status === 400 && SCHEMA_ISSUE_PATTERN.test(message)) {
      return "schema_too_complex";
    }
    return "provider_error";
  }
  return "provider_error";
}
