/**
 * Única puerta permitida para hacer inferencia de texto contra OpenAI.
 *
 * Antes de este módulo `generateText` guardaba un cliente en una variable de
 * módulo y lo reutilizaba durante toda la vida del proceso: la única condición
 * para salir a la red era que existiera `OPENAI_API_KEY`. Tener la credencial no
 * es haber autorizado el envío — y menos aquí, donde el prompt lleva el Brand
 * Brain completo del cliente: servicios, diferenciadores, dolores del público y
 * las objeciones frecuentes con sus respuestas aprobadas.
 *
 * Igual que en `./anthropic-egress`, este módulo **no exporta el cliente**. El
 * `new OpenAI(...)` vive privado aquí y ocurre siempre después de la guarda.
 *
 * Orden obligatorio:
 *
 *   1. `assertAiEgressAllowed` — resuelve proveedor y modelo contra la política.
 *   2. `buildParams()` — la fábrica corre **después**: si la guarda bloquea, el
 *      request del SDK no llega a construirse.
 *   3. leer la credencial.
 *   4. construir el cliente.
 *   5. invocar el SDK.
 *   6. traducir el error a `AiProviderError`.
 *
 * El cliente se construye por llamada y no se cachea. Uno cacheado congela la
 * configuración del primer uso y sobrevive a un cambio de entorno; el coste de
 * construir el wrapper es irrelevante frente a la propia llamada de red.
 *
 * El `model` lo inyecta esta frontera, no `buildParams`: el modelo que se
 * autorizó y el que viaja al SDK son literalmente el mismo string.
 */

import OpenAI from "openai";
import { assertAiEgressAllowed, EgressBlockedError, type AiOperation } from "@/lib/egress-guard";
import { AiProviderError, type AiProviderErrorCode } from "./errors";

const PROVIDER = "openai" as const;

/**
 * Superficie del SDK que este módulo usa. Un cliente real la satisface; los
 * tests inyectan un doble. Existe solo para la inyección de dependencias — no
 * para exponer el cliente.
 */
export type OpenAiClientLike = Pick<OpenAI, "chat">;

/** Parámetros de la llamada SIN `model` — lo pone la frontera, ver cabecera. */
export type OpenAiChatParams = Omit<
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  "model"
>;

interface ProtectedChatCall {
  /** Operación semántica — la política distingue analizar de generar. */
  operation: AiOperation;
  /** Modelo exacto que se enviará al SDK si la guarda autoriza. */
  model: string;
  /** Fábrica diferida: NO se ejecuta cuando la guarda bloquea. */
  buildParams: () => OpenAiChatParams;
  /** Solo para tests. Aunque venga inyectada, la guarda ya corrió antes. */
  clientFactory?: () => OpenAiClientLike;
}

/**
 * Construye el cliente real. Privado a propósito: es la única frontera del repo
 * donde existe un `new OpenAI(...)`.
 */
function buildClient(operation: AiOperation): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiProviderError({ provider: PROVIDER, operation, code: "ai_not_configured" });
  }
  return new OpenAI({ apiKey });
}

function hasName(err: unknown, name: string): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === name;
}

/**
 * Traduce cualquier fallo del SDK a `AiProviderError`.
 *
 * El mensaje original no se propaga: un `APIError` de OpenAI cita el cuerpo de
 * la respuesta, que puede contener fragmentos del prompt o de la salida. Solo
 * sobreviven el código estable y el status numérico.
 *
 * `EgressBlockedError` NO se traduce: es un fallo de política, ya viene saneado
 * y convertirlo en error de proveedor ocultaría que la llamada nunca salió.
 */
function sanitizeError(err: unknown, operation: AiOperation): never {
  if (err instanceof EgressBlockedError) throw err;
  if (err instanceof AiProviderError) throw err;

  let code: AiProviderErrorCode = "ai_provider_error";
  let status: number | undefined;

  if (
    err instanceof OpenAI.APIConnectionTimeoutError ||
    hasName(err, "AbortError") ||
    hasName(err, "APIConnectionTimeoutError")
  ) {
    code = "ai_timeout";
  } else if (
    err instanceof OpenAI.APIError ||
    (typeof err === "object" && err !== null && "status" in err)
  ) {
    const candidate = err as { status?: unknown };
    if (typeof candidate.status === "number") status = candidate.status;
  }

  throw new AiProviderError({ provider: PROVIDER, operation, code, status });
}

/** Llamada protegida de chat. Sustituye a `client.chat.completions.create(...)`. */
export async function openaiChatCreate(
  call: ProtectedChatCall
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const { operation, model, buildParams, clientFactory } = call;

  assertAiEgressAllowed({ provider: PROVIDER, model, operation });

  const params = buildParams();
  const client = clientFactory ? clientFactory() : buildClient(operation);

  try {
    return await client.chat.completions.create({ ...params, model });
  } catch (err) {
    sanitizeError(err, operation);
  }
}
