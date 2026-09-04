/**
 * Única puerta permitida para hacer inferencia contra Google Gemini
 * (WO-2026-00222 — brief de propuesta desde Cotizaciones, modelo barato
 * `gemini-2.0-flash-lite`).
 *
 * Mismo contrato que `./anthropic-egress`: no se expone cliente, solo una
 * operación protegida. No se usa el SDK oficial de Google (no estaba
 * instalado y esta frontera es una sola llamada REST) — `fetch` directo a
 * `generativelanguage.googleapis.com`, igual de "sin cliente expuesto" que un
 * SDK privado a este módulo.
 *
 * Orden obligatorio, igual que Anthropic:
 *
 *   1. `assertAiEgressAllowed` — resuelve proveedor y modelo contra la política.
 *   2. `buildParams()` corre **después**: si la guarda bloquea, el prompt ni
 *      siquiera se construye.
 *   3. Fetch al endpoint REST.
 *   4. Traducir cualquier fallo a `AiProviderError` (mismos códigos que
 *      Anthropic, para que el consumidor no distinga proveedor por error).
 */

import { assertAiEgressAllowed, EgressBlockedError, type AiOperation } from "@/lib/egress-guard";
import { AiProviderError, type AiProviderErrorCode } from "./errors";

export { AiProviderError } from "./errors";
export type { AiProviderErrorCode } from "./errors";
export type { AiOperation } from "@/lib/egress-guard";

const PROVIDER = "google" as const;
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 30_000;

export interface GeminiGenerateParams {
  /** Prompt de usuario único — este módulo no maneja historial multi-turno. */
  prompt: string;
  /** Tokens máximos de salida. */
  maxOutputTokens?: number;
  /** 0-1, default bajo (0.3) porque esto alimenta un documento comercial. */
  temperature?: number;
}

interface ProtectedCall {
  /** Operación semántica — la política distingue analizar de generar. */
  operation: AiOperation;
  /** Modelo exacto que se enviará al endpoint si la guarda autoriza. */
  model: string;
  /** Fábrica diferida: NO se ejecuta cuando la guarda bloquea. */
  buildParams: () => GeminiGenerateParams;
  /** Solo para tests: sustituye el fetch real. */
  fetchImpl?: typeof fetch;
}

function hasName(err: unknown, name: string): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === name;
}

/**
 * Traduce cualquier fallo (de red o del propio endpoint) a `AiProviderError`.
 * El cuerpo de la respuesta de error se inspecciona aquí — el único lugar
 * donde puede mirarse sin filtrarlo — y después se descarta, igual que en
 * `anthropic-egress.ts`: puede citar fragmentos del prompt.
 */
function sanitizeError(err: unknown, operation: AiOperation): never {
  if (err instanceof EgressBlockedError) throw err;
  if (err instanceof AiProviderError) throw err;

  let code: AiProviderErrorCode = "ai_provider_error";
  let status: number | undefined;

  if (hasName(err, "AbortError") || hasName(err, "TimeoutError")) {
    code = "ai_timeout";
  } else if (typeof err === "object" && err !== null && "status" in err) {
    const candidate = err as { status?: unknown };
    if (typeof candidate.status === "number") {
      status = candidate.status;
      if (status >= 300 && status < 400) code = "ai_redirect_blocked";
      if (status === 400) code = "ai_schema_rejected";
    }
  }

  throw new AiProviderError({ provider: PROVIDER, operation, code, status });
}

interface GeminiResponseBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}

/**
 * Llamada single-shot protegida a Gemini. Devuelve solo el texto generado
 * (concatenación de las partes de texto del primer candidato) — el
 * consumidor no necesita el sobre completo de la API.
 */
export async function geminiGenerateText(call: ProtectedCall): Promise<string> {
  const { operation, model, buildParams } = call;

  assertAiEgressAllowed({ provider: PROVIDER, model, operation });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiProviderError({ provider: PROVIDER, operation, code: "ai_not_configured" });
  }

  const params = buildParams();
  const doFetch = call.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await doFetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: params.prompt }] }],
        generationConfig: {
          maxOutputTokens: params.maxOutputTokens ?? 1024,
          temperature: params.temperature ?? 0.3,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // El cuerpo de error se descarta sin leerlo — ver sanitizeError.
      throw { status: res.status };
    }

    const body = (await res.json()) as GeminiResponseBody;
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return text;
  } catch (err) {
    sanitizeError(err, operation);
  } finally {
    clearTimeout(timeout);
  }
}
