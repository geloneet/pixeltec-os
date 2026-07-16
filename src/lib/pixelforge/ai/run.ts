/**
 * Motor de ejecución de operaciones IA de PixelForge — Structured Outputs
 * vía `client.messages.parse` + `zodOutputFormat` (SDK 0.91.1). Recibe el
 * cliente Anthropic INYECTADO (no importa `./client`, que trae
 * `"server-only"`) para ser testeable sin red y sin DB: la persistencia y el
 * cierre de la corrida llegan como callbacks (`RunCallbacks`) — el
 * repositorio real (claimRun/finishRun contra `ai_runs`) se conecta en
 * F2-T4/T5.
 *
 * NO se envía `temperature`/`top_p`/`top_k` (Sonnet 5 los rechaza con 400).
 * Sin streaming — `messages.parse` es single-shot, convención de la casa.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// `zod/v4`, NO `"zod"` (v3 clásico) — `domainSchema`/`OPERATION_SPECS[...].outputSchema` son
// schemas de `../schemas/`, migrados a `zod/v4` porque lo exige `zodOutputFormat` (ver ese
// directorio para el detalle). Solo tipos aquí — sin acoplar `run.ts` a un runtime de Zod real.
import type { z } from "zod/v4";
import { OPERATION_SPECS, type PixelforgeAIOperation } from "../schemas";
import { classifyError, classifyStopReason, type PixelforgeRunFailure } from "./failures";
import { resolvePixelForgeModel } from "./model";

export interface RunCallbacks {
  onProgress?: (progress: number, currentStep: string) => Promise<void>;
  /** Corre ANTES de marcar succeeded; el caller la hace transaccional con finishRun en F2-T4/T5. */
  persistResult: (output: unknown) => Promise<void>;
  finishRun: (result: RunResult) => Promise<void>;
}

export interface RunResult {
  status: "succeeded" | "failed";
  failureKind?: PixelforgeRunFailure;
  error?: string;
  tokensIn?: number;
  tokensOut?: number;
  durationMs: number;
  retryCount: number;
}

export interface ExecuteOperationParams {
  /** Inyectado — testeable sin instanciar el SDK real (ver `./client`). */
  client: Anthropic;
  operation: PixelforgeAIOperation;
  system: string;
  messages: Anthropic.MessageParam[];
  /** Refines de dominio (p.ej. `contextBriefDomainSchema`) — aplicados DESPUÉS del parseo de Structured Outputs. */
  domainSchema?: z.ZodTypeAny;
  callbacks: RunCallbacks;
}

export type ExecuteOperationResult = { output: unknown } | { failure: PixelforgeRunFailure; error: string };

const REFUSAL_MESSAGE = "El modelo rechazó generar una respuesta para esta operación.";
const MAX_TOKENS_MESSAGE = "La respuesta del modelo alcanzó el límite de tokens configurado antes de completarse.";
const NO_PARSED_OUTPUT_MESSAGE = "El modelo no devolvió salida parseable.";

function stopFailureMessage(kind: PixelforgeRunFailure): string {
  // classifyStopReason (./failures) solo devuelve "refusal" | "max_tokens" | null en la práctica —
  // el tipo de retorno es el `PixelforgeRunFailure` ancho de la taxonomía completa, así que
  // cubrimos el resto con un mensaje genérico en vez de castear.
  if (kind === "refusal") return REFUSAL_MESSAGE;
  if (kind === "max_tokens") return MAX_TOKENS_MESSAGE;
  return "El modelo detuvo la generación por un motivo inesperado.";
}

function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`).join("\n");
}

function messageFromError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * `zodOutputFormat` en runtime usa `zod/v4` (`helpers/zod.ts`: `import * as z from 'zod/v4'`),
 * pero su `.d.ts` publicado tipa el parámetro como el `ZodType` de `"zod"` a secas — que en este
 * repo resuelve a la API v3 clásica (verificado leyendo
 * `node_modules/@anthropic-ai/sdk/helpers/zod.d.ts`: `import type { ZodType } from 'zod'`, sin
 * `/v4`). Es una inconsistencia del propio paquete de tipos del SDK, no nuestra: los schemas de
 * `OPERATION_SPECS`/`domainSchema` SÍ son `zod/v4` reales (ver `../schemas/`), que es exactamente
 * lo que la implementación real necesita — el cast solo evita que TS compare contra el tipo v3
 * equivocado del `.d.ts`.
 */
function buildOutputFormat(schema: z.ZodTypeAny): ReturnType<typeof zodOutputFormat> {
  return zodOutputFormat(schema as unknown as Parameters<typeof zodOutputFormat>[0]);
}

/** Respuesta de `messages.parse` — tipada laxa a propósito: `spec.outputSchema` es `z.ZodTypeAny`, así que `parsed_output` no puede inferirse de forma más específica sin perder la genericidad de `OPERATION_SPECS`. */
interface ParseResponse {
  stop_reason: string | null;
  parsed_output: unknown;
  usage: { input_tokens: number; output_tokens: number };
}

export async function executeOperation(params: ExecuteOperationParams): Promise<ExecuteOperationResult> {
  const { client, operation, system, messages, domainSchema, callbacks } = params;

  // 1. spec + model.
  const spec = OPERATION_SPECS[operation];
  const model = resolvePixelForgeModel(operation);

  const startedAt = Date.now();
  let tokensIn = 0;
  let tokensOut = 0;
  let retryCount = 0;

  async function fail(failureKind: PixelforgeRunFailure, error: string): Promise<ExecuteOperationResult> {
    // 9. Cualquier fallo: finishRun(failed) exactamente una vez, con tokens acumulados hasta el punto de fallo.
    await callbacks.finishRun({
      status: "failed",
      failureKind,
      error,
      tokensIn,
      tokensOut,
      durationMs: Date.now() - startedAt,
      retryCount,
    });
    return { failure: failureKind, error };
  }

  async function callModel(callMessages: Anthropic.MessageParam[]): Promise<ParseResponse | { error: PixelforgeRunFailure; message: string }> {
    try {
      const response = (await client.messages.parse({
        model,
        max_tokens: spec.maxTokens,
        system,
        messages: callMessages,
        output_config: { format: buildOutputFormat(spec.outputSchema) },
      })) as unknown as ParseResponse;
      return response;
    } catch (err) {
      return { error: classifyError(err), message: messageFromError(err) };
    }
  }

  // 2. Progreso inicial.
  await callbacks.onProgress?.(10, "Llamando al modelo");

  // 3. Primera llamada — errores del SDK → classifyError.
  const first = await callModel(messages);
  if ("error" in first) {
    return fail(first.error, first.message);
  }

  tokensIn += first.usage.input_tokens;
  tokensOut += first.usage.output_tokens;

  // 4. stop_reason antes de leer parsed_output.
  const firstStopFailure = classifyStopReason(first.stop_reason);
  if (firstStopFailure) {
    return fail(firstStopFailure, stopFailureMessage(firstStopFailure));
  }

  // 5. parsed_output null → provider_error.
  if (first.parsed_output === null || first.parsed_output === undefined) {
    return fail("provider_error", NO_PARSED_OUTPUT_MESSAGE);
  }

  let output: unknown = first.parsed_output;

  // 6. Refines de dominio — 1 retry si falla.
  if (domainSchema) {
    const firstAttempt = domainSchema.safeParse(output);
    if (!firstAttempt.success) {
      retryCount = 1;
      await callbacks.onProgress?.(60, "Corrigiendo validación de dominio");

      const errorsText = formatZodErrors(firstAttempt.error);
      const retryMessages: Anthropic.MessageParam[] = [
        ...messages,
        { role: "assistant", content: JSON.stringify(output) },
        {
          role: "user",
          content: `La salida violó estas reglas de dominio:\n${errorsText}\nDevuelve la salida corregida completa.`,
        },
      ];

      const retry = await callModel(retryMessages);
      if ("error" in retry) {
        return fail(retry.error, retry.message);
      }

      // 7. Acumula tokens de TODAS las llamadas.
      tokensIn += retry.usage.input_tokens;
      tokensOut += retry.usage.output_tokens;

      const retryStopFailure = classifyStopReason(retry.stop_reason);
      if (retryStopFailure) {
        return fail(retryStopFailure, stopFailureMessage(retryStopFailure));
      }

      if (retry.parsed_output === null || retry.parsed_output === undefined) {
        return fail("provider_error", NO_PARSED_OUTPUT_MESSAGE);
      }

      const secondAttempt = domainSchema.safeParse(retry.parsed_output);
      if (!secondAttempt.success) {
        return fail("domain_validation", formatZodErrors(secondAttempt.error));
      }
      output = secondAttempt.data;
    } else {
      output = firstAttempt.data;
    }
  }

  // 8. Persistir + succeeded.
  await callbacks.onProgress?.(85, "Guardando resultado");
  await callbacks.persistResult(output);
  await callbacks.finishRun({
    status: "succeeded",
    tokensIn,
    tokensOut,
    durationMs: Date.now() - startedAt,
    retryCount,
  });
  return { output };
}
