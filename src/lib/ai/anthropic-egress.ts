/**
 * Única puerta permitida para hacer inferencia contra Anthropic.
 *
 * Antes de este módulo la app tenía ocho fronteras hacia Anthropic y ocho
 * construcciones de cliente: cinco rutas hacían `new Anthropic()` inline y tres
 * fábricas lo devolvían crudo tras comprobar que existiera la clave. Comprobar
 * la credencial no es una política: el día que alguien pega una clave real para
 * probar una plantilla, el entorno empieza a mandar sesiones de trabajo,
 * propuestas y datos de clientes a un tercero sin que nadie lo haya autorizado.
 *
 * Por eso aquí **no se exporta el cliente**, solo operaciones protegidas. El
 * `new Anthropic(...)` vive privado en este archivo y ocurre siempre después de
 * la guarda.
 *
 * Orden obligatorio de cada operación:
 *
 *   1. `assertAiEgressAllowed` — resuelve proveedor y modelo contra la política.
 *   2. `buildParams()` — la fábrica de parámetros corre **después**: si la
 *      guarda bloquea, el payload ni siquiera llega a construirse.
 *   3. obtener o construir el cliente.
 *   4. invocar el SDK (`messages.create` / `messages.stream`).
 *   5. en streaming, esperar `finalMessage()` **dentro** de esta frontera — el
 *      error puede ocurrir al crear el stream o al resolverlo, y ambas fases
 *      deben quedar del lado saneado.
 *   6. traducir el error a `AiProviderError`.
 *
 * El `model` se inyecta aquí, no lo trae `buildParams`: así el modelo que se
 * autorizó y el que viaja al SDK son literalmente el mismo string, sin
 * normalizar ni reescribir.
 */

import Anthropic from "@anthropic-ai/sdk";
import { assertAiEgressAllowed, EgressBlockedError, type AiOperation } from "@/lib/egress-guard";
import { AiProviderError, type AiProviderErrorCode } from "./errors";

export { AiProviderError } from "./errors";
export type { AiProviderErrorCode } from "./errors";
export type { AiOperation } from "@/lib/egress-guard";

const PROVIDER = "anthropic" as const;

/**
 * Superficie del SDK que este módulo usa. Un cliente real de Anthropic la
 * satisface; los tests inyectan un doble con el mismo cast que ya usaban.
 * Existe solo para la inyección de dependencias — no para exponer el cliente.
 */
export type AnthropicClientLike = Pick<Anthropic, "messages">;

/** Parámetros de la llamada SIN `model` — lo pone la frontera, ver cabecera. */
export type AnthropicCreateParams = Omit<Anthropic.MessageCreateParamsNonStreaming, "model">;
export type AnthropicStreamParams = Omit<Anthropic.MessageStreamParams, "model">;

interface ProtectedCall<P> {
  /** Operación semántica — la política distingue analizar de generar. */
  operation: AiOperation;
  /** Modelo exacto que se enviará al SDK si la guarda autoriza. */
  model: string;
  /** Fábrica diferida: NO se ejecuta cuando la guarda bloquea. */
  buildParams: () => P;
  /** Solo para tests. Aunque venga inyectado, la guarda ya corrió antes. */
  client?: AnthropicClientLike;
}

/**
 * Construye el cliente real. Privado a propósito: es la única frontera del repo
 * donde existe un `new Anthropic(...)`.
 *
 * No se cachea a nivel de módulo. Un cliente cacheado congela la configuración
 * del primer uso y sobrevive a cambios de entorno; construirlo por llamada no
 * abre conexiones ni cuesta nada medible.
 */
function buildClient(operation: AiOperation): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiProviderError({ provider: PROVIDER, operation, code: "ai_not_configured" });
  }
  return new Anthropic({ apiKey });
}

const SCHEMA_ISSUE_PATTERN = /schema|grammar|output_config|format/i;

function hasName(err: unknown, name: string): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === name;
}

/**
 * Traduce cualquier fallo del SDK a `AiProviderError`.
 *
 * El mensaje original se inspecciona aquí —el único lugar donde puede mirarse
 * sin filtrarlo— para decidir el `code`, y después se descarta: un `APIError`
 * de Anthropic cita el cuerpo de la respuesta, que puede contener fragmentos
 * del prompt o de la salida.
 *
 * `EgressBlockedError` NO se traduce: es un fallo de política, ya viene saneado
 * (canal/operación/razón, sin destino) y convertirlo en error de proveedor
 * ocultaría que la llamada nunca salió.
 */
function sanitizeError(err: unknown, operation: AiOperation): never {
  if (err instanceof EgressBlockedError) throw err;
  if (err instanceof AiProviderError) throw err;

  let code: AiProviderErrorCode = "ai_provider_error";
  let status: number | undefined;

  if (
    err instanceof Anthropic.APIConnectionTimeoutError ||
    hasName(err, "AbortError") ||
    hasName(err, "APIConnectionTimeoutError")
  ) {
    code = "ai_timeout";
  } else if (
    err instanceof Anthropic.APIError ||
    (typeof err === "object" && err !== null && "status" in err)
  ) {
    const candidate = err as { status?: unknown; message?: unknown };
    if (typeof candidate.status === "number") status = candidate.status;
    const message = typeof candidate.message === "string" ? candidate.message : "";
    if (status === 400 && SCHEMA_ISSUE_PATTERN.test(message)) {
      code = "ai_schema_rejected";
    }
  }

  throw new AiProviderError({ provider: PROVIDER, operation, code, status });
}

/** Llamada single-shot protegida. Sustituye a `client.messages.create(...)`. */
export async function anthropicCreate(
  call: ProtectedCall<AnthropicCreateParams>
): Promise<Anthropic.Message> {
  const { operation, model, buildParams } = call;

  assertAiEgressAllowed({ provider: PROVIDER, model, operation });

  const params = buildParams();
  const client = call.client ?? buildClient(operation);

  try {
    return await client.messages.create({ ...params, model });
  } catch (err) {
    sanitizeError(err, operation);
  }
}

/**
 * Llamada en streaming protegida, resuelta a su `Message` final. Sustituye al
 * par `client.messages.stream(...)` + `stream.finalMessage()`: las dos fases
 * quedan dentro de la frontera, así que ni la creación del stream ni su
 * resolución pueden filtrar un error crudo del SDK.
 */
export async function anthropicStreamFinalMessage(
  call: ProtectedCall<AnthropicStreamParams>
): Promise<Anthropic.Message> {
  const { operation, model, buildParams } = call;

  assertAiEgressAllowed({ provider: PROVIDER, model, operation });

  const params = buildParams();
  const client = call.client ?? buildClient(operation);

  try {
    const stream = client.messages.stream({ ...params, model });
    return await stream.finalMessage();
  } catch (err) {
    sanitizeError(err, operation);
  }
}
