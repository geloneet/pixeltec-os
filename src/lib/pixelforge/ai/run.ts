/**
 * Motor de ejecución de operaciones IA de PixelForge — Structured Outputs
 * vía `client.messages.stream` + `output_config.format` (`zodOutputFormat`,
 * SDK 0.91.1) con PARSEO MANUAL de la respuesta, en vez de
 * `client.messages.parse()`. La llamada al SDK pasa SIEMPRE por
 * `@/lib/ai/anthropic-egress`, que aplica la política de egress de IA antes de
 * armar el payload y es el único módulo que instancia el cliente; el `client`
 * inyectado sigue existiendo para los tests (sin red, sin SDK real) y también
 * entra por esa frontera protegida. La persistencia y el cierre de la corrida
 * llegan como callbacks (`RunCallbacks`) — el repositorio real
 * (claimRun/finishRun contra `ai_runs`) se conecta en F2-T4/T5.
 *
 * Por qué NO `messages.parse()` (hallazgo C1 de la revisión final F2):
 * `client.messages.parse()` es azúcar sobre `create().then(parseMessage)`, y
 * `parseMessage` corre `outputFormat.parse(block.text)` INCONDICIONALMENTE —
 * sin mirar `stop_reason` primero. Si la respuesta se truncó por
 * `max_tokens`, el texto queda con JSON a medias y ese `parse()` interno
 * LANZA una `AnthropicError` (`"Failed to parse structured output as
 * JSON..."`) ANTES de que este módulo pueda leer `stop_reason` — el catch de
 * `callModel` la reclasificaba entonces como error genérico, y la corrida
 * nunca registraba `failureKind: "max_tokens"` real (la taxonomía dejaba de
 * ser observable). Por eso hacemos nosotros mismos el parseo, en este orden:
 * 1) clasificar `stop_reason` PRIMERO (gana aunque el texto truncado
 * pareciera parseable), 2) extraer el texto de los bloques `content` tipo
 * `"text"`, 3) `JSON.parse` propio, 4) `spec.outputSchema.safeParse` — la
 * validación de FORMA que la gramática no garantiza al 100% (p.ej.
 * `minLength`/`minItems` puede degradarse, ver `transform-json-schema` del
 * SDK), tratada como `domain_validation` y enrutada al MISMO retry semántico
 * que los refines de dominio.
 *
 * `client.messages.stream(...)` + `stream.finalMessage()` en vez de
 * `.create()` (fix F5-6): el SDK lanza client-side "Streaming is required for
 * operations that may take longer than 10 minutes" en `.create()` no-stream
 * cuando `max_tokens` es alto (`generate_directions` subió a 24000, por
 * encima del umbral ~21333 que calcula `_calculateNonstreamingTimeout`), ANTES
 * de cualquier request HTTP — reproducido determinísticamente en el smoke F5
 * (`failure_kind=provider_error`, tokens 0/0). `.stream()` acepta los mismos
 * params y `finalMessage()` resuelve al mismo `Message` completo — mismo
 * pipeline de abajo, solo cambia el transporte. IMPORTANTE: `buildOutputFormat`
 * quita a propósito el `.parse` que trae `zodOutputFormat(...)` antes de
 * pasarlo a `output_config.format` — ver el comentario de esa función: sin
 * quitarlo, `.stream()` reintroduciría el MISMO bug C1 (invoca `.parse`
 * SIEMPRE en `message_stop`, sin importar `.create()` vs `.stream()`).
 *
 * NO se envía `temperature`/`top_p`/`top_k` (Sonnet 5 los rechaza con 400).
 */
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// `zod/v4`, NO `"zod"` (v3 clásico) — `domainSchema`/`OPERATION_SPECS[...].outputSchema` son
// schemas de `../schemas/`, migrados a `zod/v4` porque lo exige `zodOutputFormat` (ver ese
// directorio para el detalle). Solo tipos aquí — sin acoplar `run.ts` a un runtime de Zod real.
import type { z } from "zod/v4";
import {
  anthropicStreamFinalMessage,
  type AnthropicClientLike,
  type AiOperation,
} from "@/lib/ai/anthropic-egress";
import { OPERATION_SPECS, type PixelforgeAIOperation } from "../schemas";
import { classifyError, classifyStopReason, type PixelforgeRunFailure } from "./failures";
import {
  EMPTY_TEXT_MESSAGE,
  INVALID_JSON_MESSAGE,
  RUN_PUBLIC_MESSAGES,
  STOP_UNEXPECTED_MESSAGE,
} from "./public-messages";
import { resolvePixelForgeModel } from "./model";

/**
 * Operación semántica de egress por operación de PixelForge. El `Record`
 * exhaustivo es deliberado: una operación nueva sin clasificar rompe el
 * typecheck en vez de heredar un permiso en silencio.
 */
const AI_EGRESS_OPERATION: Record<PixelforgeAIOperation, AiOperation> = {
  analyze_context: "analyze",
  generate_strategy: "generate_text",
  analyze_reference: "analyze",
  synthesize_visual_dna: "generate_text",
  generate_directions: "generate_text",
  build_narrative: "generate_text",
  compose_page_tree: "generate_text",
  propose_change: "generate_text",
  critique_design: "analyze",
  score_originality: "analyze",
  detect_ai_likeness: "analyze",
};

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
  /**
   * Inyectado solo en tests — testeable sin red y sin SDK real. En producción
   * se omite y lo construye `@/lib/ai/anthropic-egress`, **después** de la
   * guarda de egress. Inyectarlo NO salta la guarda: el adaptador la aplica
   * igual antes de tocar el cliente.
   */
  client?: AnthropicClientLike;
  operation: PixelforgeAIOperation;
  system: string;
  messages: Anthropic.MessageParam[];
  /** Refines de dominio (p.ej. `contextBriefDomainSchema`) — aplicados DESPUÉS del parseo de Structured Outputs. */
  domainSchema?: z.ZodTypeAny;
  callbacks: RunCallbacks;
}

export type ExecuteOperationResult = { output: unknown } | { failure: PixelforgeRunFailure; error: string };

function stopFailureMessage(kind: PixelforgeRunFailure): string {
  // classifyStopReason (./failures) solo devuelve "refusal" | "max_tokens" | null en la práctica —
  // el tipo de retorno es el `PixelforgeRunFailure` ancho de la taxonomía completa, así que
  // cubrimos el resto con un mensaje genérico en vez de castear.
  if (kind === "refusal") return RUN_PUBLIC_MESSAGES.refusal;
  if (kind === "max_tokens") return RUN_PUBLIC_MESSAGES.max_tokens;
  return STOP_UNEXPECTED_MESSAGE;
}

/**
 * Solo para el prompt del retry semántico (viaja al modelo, nunca a
 * `finishRun`): los issues de Zod pueden citar valores de la salida del modelo
 * y por eso lo que se PERSISTE ante `domain_validation` es el mensaje fijo de
 * `RUN_PUBLIC_MESSAGES`, no este texto (E0f-3b).
 */
function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`).join("\n");
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
 *
 * Devuelve `Anthropic.JSONOutputFormat` (`{ type, schema }`) SIN el `.parse` que trae
 * `zodOutputFormat(...)` — se descarta a propósito. `client.messages.stream(...)`
 * (a diferencia de `.create()`) inspecciona `output_config.format` en CADA `message_stop`
 * vía `maybeParseMessage`/`'parse' in outputFormat` (ver
 * `node_modules/@anthropic-ai/sdk/src/lib/parser.ts` y `.../lib/MessageStream.ts`), sin
 * importar si el caller usó `.parse()` o `.stream()` — si el format trae `.parse`, lo INVOCA
 * SIEMPRE, y ese `.parse` interno (`helpers/zod.ts`) hace `JSON.parse` + `zodObject.safeParse`
 * y LANZA `AnthropicError` si cualquiera de los dos falla. Eso reintroduciría el bug C1 (el
 * mismo que motivó no usar `messages.parse()`, ver comentario de cabecera) pero un nivel más
 * abajo: `stream.finalMessage()` rechazaría ANTES de que este módulo pueda leer `stop_reason`
 * — tanto en truncamientos por `max_tokens` como en cualquier respuesta con JSON válido pero
 * que viola `outputSchema`/`domainSchema` (rompiendo el retry semántico de `domain_validation`
 * por completo, ya que todo terminaría clasificado como `provider_error` genérico vía
 * `classifyError`). El servidor solo necesita `{ type: 'json_schema', schema }` para compilar
 * la gramática — `.parse` es un helper 100% cliente que nunca viaja por HTTP — así que quitarlo
 * preserva el constraint de Structured Outputs intacto y mantiene a `run.ts` haciendo su propio
 * pipeline `stop_reason` → texto → `JSON.parse` → `safeParse`, ahora con `.stream()` como
 * transporte.
 */
function buildOutputFormat(schema: z.ZodTypeAny): Anthropic.JSONOutputFormat {
  const { type, schema: jsonSchema } = zodOutputFormat(schema as unknown as Parameters<typeof zodOutputFormat>[0]);
  return { type, schema: jsonSchema };
}

/**
 * Respuesta de `messages.create` — tipada laxa a propósito (solo los campos
 * que este módulo lee): `stop_reason` se clasifica ANTES que nada, `content`
 * se recorre para extraer texto, `usage` se acumula. Nada de `parsed_output`
 * — ver comentario de cabecera del archivo (C1).
 */
interface CreateResponse {
  stop_reason: string | null;
  content: Anthropic.ContentBlock[];
  usage: { input_tokens: number; output_tokens: number };
}

/** Concatena los bloques `content` de type `"text"` — Structured Outputs entrega el JSON como texto plano restringido por la gramática, en uno o más bloques. */
function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

type ProcessResult =
  | { ok: true; data: unknown }
  | { ok: false; failure: "provider_error"; error: string }
  | { ok: false; failure: "domain_validation"; error: string; json: unknown };

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

  async function callModel(callMessages: Anthropic.MessageParam[]): Promise<CreateResponse | { error: PixelforgeRunFailure; message: string }> {
    try {
      // `stream(...)` + `finalMessage()` quedan DENTRO del adaptador: la guarda
      // corre antes de armar params, y ninguna de las dos fases puede filtrar
      // un error crudo del SDK. El retry semántico vuelve a pasar por aquí, así
      // que también vuelve a atravesar la guarda.
      const response = (await anthropicStreamFinalMessage({
        operation: AI_EGRESS_OPERATION[operation],
        model,
        client,
        buildParams: () => ({
          max_tokens: spec.maxTokens,
          system,
          messages: callMessages,
          output_config: { format: buildOutputFormat(spec.outputSchema) },
        }),
      })) as unknown as CreateResponse;
      return response;
    } catch (err) {
      // El `message` del SDK/proveedor no cruza (E0f-3b): se persiste el
      // mensaje público fijo del kind; la taxonomía queda en `failureKind` y
      // el log solo lleva el nombre del error.
      const kind = classifyError(err);
      console.error("[pixelforge/run] llamada al proveedor falló", {
        operation,
        kind,
        error: err instanceof Error ? err.name : typeof err,
      });
      return { error: kind, message: RUN_PUBLIC_MESSAGES[kind] };
    }
  }

  /**
   * Forma+dominio en un único paso — `spec.outputSchema` (forma, la gramática
   * NO la garantiza al 100%) y, si hay `domainSchema` (refines), también eso.
   * Se usa tanto en la 1ra respuesta como en la de retry: así el retry se
   * valida "completo forma+dominio" en una sola pasada, sin reintentos
   * anidados.
   */
  function validateOutput(json: unknown): { success: true; data: unknown } | { success: false; errorsText: string } {
    const shapeResult = spec.outputSchema.safeParse(json);
    if (!shapeResult.success) {
      return { success: false, errorsText: formatZodErrors(shapeResult.error) };
    }
    if (domainSchema) {
      const domainResult = domainSchema.safeParse(json);
      if (!domainResult.success) {
        return { success: false, errorsText: formatZodErrors(domainResult.error) };
      }
      return { success: true, data: domainResult.data };
    }
    return { success: true, data: shapeResult.data };
  }

  /** Pipeline post stop_reason: extraer texto → JSON.parse propio → validar forma+dominio. */
  function processResponse(response: CreateResponse): ProcessResult {
    const text = extractText(response.content);
    if (!text) {
      return { ok: false, failure: "provider_error", error: EMPTY_TEXT_MESSAGE };
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, failure: "provider_error", error: INVALID_JSON_MESSAGE };
    }
    const validated = validateOutput(json);
    if (!validated.success) {
      return { ok: false, failure: "domain_validation", error: validated.errorsText, json };
    }
    return { ok: true, data: validated.data };
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

  // 4. stop_reason ANTES de leer el texto — gana aunque el texto truncado pareciera parseable.
  const firstStopFailure = classifyStopReason(first.stop_reason);
  if (firstStopFailure) {
    return fail(firstStopFailure, stopFailureMessage(firstStopFailure));
  }

  const firstResult = processResponse(first);

  let output: unknown;

  if (!firstResult.ok && firstResult.failure === "provider_error") {
    // Texto vacío o JSON roto con stop_reason end_turn — la gramática debió garantizar JSON; sin retry.
    return fail("provider_error", firstResult.error);
  }

  if (!firstResult.ok) {
    // 6. Validación de forma/dominio falló → 1 retry semántico (máximo 1 retry TOTAL).
    retryCount = 1;
    await callbacks.onProgress?.(60, "Corrigiendo validación de dominio");

    const retryMessages: Anthropic.MessageParam[] = [
      ...messages,
      { role: "assistant", content: JSON.stringify(firstResult.json) },
      {
        role: "user",
        content: `La salida violó estas reglas de dominio:\n${firstResult.error}\nDevuelve la salida corregida completa.`,
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

    // La respuesta del retry se valida COMPLETA forma+dominio — sin un segundo retry pase lo que pase.
    const retryResult = processResponse(retry);
    if (!retryResult.ok) {
      // `domain_validation` final: el texto de Zod (que puede citar la salida
      // del modelo) no se persiste — mensaje fijo. Los de `provider_error` ya
      // son literales propios (EMPTY/INVALID).
      return fail(
        retryResult.failure,
        retryResult.failure === "domain_validation"
          ? RUN_PUBLIC_MESSAGES.domain_validation
          : retryResult.error
      );
    }
    output = retryResult.data;
  } else {
    output = firstResult.data;
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
