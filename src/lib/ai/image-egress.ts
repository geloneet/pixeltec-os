/**
 * Única puerta permitida para generar imágenes con un proveedor externo.
 *
 * Dos fronteras conviven aquí porque comparten política y forma —canal `ai`,
 * operación `generate_image`, autorización por par `proveedor:modelo`— pero no
 * comparten transporte: Ideogram es un `fetch` a mano y fal es un SDK. Cada una
 * mantiene su cliente y su traducción de errores privados; lo común es el orden.
 *
 * Orden obligatorio en ambas:
 *
 *   1. `assertAiEgressAllowed` con el modelo real que se va a enviar.
 *   2. la fábrica del request corre **después**: si la guarda bloquea, el body
 *      o el input del SDK no llegan a construirse.
 *   3. leer la credencial.
 *   4. construir el cliente (fal) o disparar el `fetch` (Ideogram).
 *   5. traducir el error a `AiProviderError`.
 *
 * El prompt de negocio lo construye el consumidor y llega capturado en la
 * closure. Esa cadena ya existía en el proceso antes de llegar aquí y su
 * construcción no es egress: lo que esta frontera garantiza es que al bloquear
 * no se arma el request del proveedor, no se lee la credencial, no se construye
 * el cliente y no sale un solo byte.
 */

import { assertAiEgressAllowed, EgressBlockedError } from "@/lib/egress-guard";
import { AiProviderError, type AiProviderErrorCode } from "./errors";

const IDEOGRAM_ENDPOINT = "https://api.ideogram.ai/generate";

const OPERATION = "generate_image" as const;

function hasName(err: unknown, name: string): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === name;
}

/**
 * Traduce cualquier fallo a `AiProviderError` conservando solo estructura.
 *
 * `EgressBlockedError` no se traduce: que una llamada no saliera por política y
 * que saliera y fallara son sucesos distintos.
 */
function sanitizeError(
  err: unknown,
  provider: "ideogram" | "fal",
  status?: number
): never {
  if (err instanceof EgressBlockedError) throw err;
  if (err instanceof AiProviderError) throw err;

  let code: AiProviderErrorCode = "ai_provider_error";
  if (hasName(err, "AbortError") || hasName(err, "TimeoutError")) code = "ai_timeout";

  throw new AiProviderError({ provider, operation: OPERATION, code, status });
}

// ── Ideogram ─────────────────────────────────────────────────────────────────

interface ProtectedIdeogramCall {
  /**
   * Modelo exacto que viaja dentro del body (`V_2`). Es el valor que se
   * autoriza; la etiqueta `ideogram_v2` del resultado es un nombre de contrato
   * interno y no describe lo que sale por el cable.
   */
  model: string;
  /** Fábrica diferida del body. NO se ejecuta cuando la guarda bloquea. */
  buildBody: () => unknown;
  /** Solo para tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Llamada protegida a Ideogram. Sustituye al `fetch` directo.
 *
 * Ante un status de error **no se lee el cuerpo de la respuesta**. Antes se
 * hacía `await res.text()` y se incrustaba en el mensaje, que terminaba en un
 * `throw` y de ahí en logs y respuestas: el cuerpo de un proveedor de imagen
 * puede citar el prompt íntegro. No se trunca ni se filtra — no se lee.
 */
export async function ideogramGenerateImage(call: ProtectedIdeogramCall): Promise<unknown> {
  const { model, buildBody } = call;

  assertAiEgressAllowed({ provider: "ideogram", model, operation: OPERATION });

  const body = buildBody();

  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) {
    throw new AiProviderError({
      provider: "ideogram",
      operation: OPERATION,
      code: "ai_not_configured",
    });
  }

  const doFetch = call.fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await doFetch(IDEOGRAM_ENDPOINT, {
      method: "POST",
      headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // `Api-Key` es una cabecera propia: en un salto cross-origin la spec de
      // fetch solo elimina Authorization, Cookie y Proxy-Authorization, así que
      // ésta viajaría íntegra al host que indique `Location`.
      redirect: "manual",
    });
  } catch (err) {
    sanitizeError(err, "ideogram");
  }

  // Todo 3xx se rechaza antes de mirar nada más. No se lee el cuerpo, no se
  // consulta `Location` y no se hace una segunda petición.
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    throw new AiProviderError({
      provider: "ideogram",
      operation: OPERATION,
      code: "ai_redirect_blocked",
      status: res.status,
    });
  }

  if (!res.ok) {
    throw new AiProviderError({
      provider: "ideogram",
      operation: OPERATION,
      code: "ai_provider_error",
      status: res.status,
    });
  }

  try {
    return await res.json();
  } catch (err) {
    sanitizeError(err, "ideogram", res.status);
  }
}

// ── fal.ai ───────────────────────────────────────────────────────────────────

/**
 * Superficie del SDK de fal que este módulo usa. Existe para la inyección de
 * dependencias en tests — no para exponer el cliente.
 */
export type FalClientLike = {
  subscribe: (
    endpointId: string,
    options: { input: Record<string, unknown> }
  ) => Promise<{ data: unknown }>;
};

interface ProtectedFalCall {
  /** Modelo/endpoint exacto que se enviará (`fal-ai/flux/schnell`, …). */
  model: string;
  /** Fábrica diferida del input. NO se ejecuta cuando la guarda bloquea. */
  buildInput: () => Record<string, unknown>;
  /** Solo para tests. */
  clientFactory?: () => FalClientLike;
}

/**
 * Construye el cliente real de fal. Privado a propósito: es la única frontera
 * del repo donde existe un `createFalClient(...)`.
 *
 * El import es dinámico para que un bloqueo de política no llegue siquiera a
 * cargar el SDK.
 */
async function buildFalClient(): Promise<FalClientLike> {
  const credentials = process.env.FAL_KEY;
  if (!credentials) {
    throw new AiProviderError({
      provider: "fal",
      operation: OPERATION,
      code: "ai_not_configured",
    });
  }
  const { createFalClient } = await import("@fal-ai/client");
  return createFalClient({ credentials }) as unknown as FalClientLike;
}

/**
 * Llamada protegida a fal. Sustituye a `createFalClient(...).subscribe(...)`.
 *
 * El polling interno del SDK se conserva: ocurre íntegro dentro de esta
 * frontera, así que un fallo en cualquier fase queda del lado saneado.
 */
export async function falSubscribe(call: ProtectedFalCall): Promise<{ data: unknown }> {
  const { model, buildInput, clientFactory } = call;

  assertAiEgressAllowed({ provider: "fal", model, operation: OPERATION });

  const input = buildInput();
  const client = clientFactory ? clientFactory() : await buildFalClient();

  try {
    return await client.subscribe(model, { input });
  } catch (err) {
    sanitizeError(err, "fal");
  }
}
