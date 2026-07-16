import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { executeOperation, type RunCallbacks } from "./run";
import { contextBriefDomainSchema, type ContextBrief } from "../schemas/analyze-context";
import { resolvePixelForgeModel } from "./model";

/**
 * Cliente mockeado: `run.ts` llama `client.messages.stream(...)` y espera
 * `stream.finalMessage()` (fix F5-6, streaming obligatorio para `max_tokens`
 * altos — ver comentario de cabecera de `./run.ts`). `stream` es un `vi.fn()`
 * cuyo valor de retorno se arma en cada test devolviendo un objeto
 * `{ finalMessage }` — así los tests siguen controlando la respuesta mockeada
 * exactamente igual que antes (mismo parseo manual, ver C1 en `./run.ts`),
 * solo cambia el nombre del método y la forma de entregar la respuesta
 * (resuelta via `finalMessage()` en vez de directamente vía `create()`).
 */
function makeClient() {
  return { messages: { stream: vi.fn() } };
}

/** Envuelve una respuesta mockeada en la forma `{ finalMessage }` que `run.ts` espera de `client.messages.stream(...)`. */
function asStream(response: unknown) {
  return { finalMessage: vi.fn(async () => response) };
}

/** Igual que `asStream`, pero para respuestas que deben RECHAZAR — el error se propaga vía `finalMessage()` rejected. */
function asRejectedStream(error: unknown) {
  return { finalMessage: vi.fn().mockRejectedValue(error) };
}

function makeCallbacks() {
  return {
    onProgress: vi.fn().mockResolvedValue(undefined),
    persistResult: vi.fn().mockResolvedValue(undefined),
    finishRun: vi.fn().mockResolvedValue(undefined),
  } satisfies RunCallbacks & Record<string, ReturnType<typeof vi.fn>>;
}

const BASE_MESSAGES: Anthropic.MessageParam[] = [{ role: "user", content: "Analiza este proyecto." }];

/** `Message` (resuelto de `finalMessage()`) que envuelve un objeto como único bloque de texto — el shape real del SDK (0.91.1) que `run.ts` parsea a mano. */
function textResponse(
  obj: unknown,
  opts: { stop_reason?: string | null; usage?: { input_tokens: number; output_tokens: number } } = {}
) {
  return {
    stop_reason: opts.stop_reason ?? "end_turn",
    content: [{ type: "text", text: JSON.stringify(obj) }],
    usage: opts.usage ?? { input_tokens: 100, output_tokens: 200 },
  };
}

function validBrief(): ContextBrief {
  return {
    confirmados: [
      {
        titulo: "Rubro",
        detalle: "La empresa se dedica a remodelaciones residenciales.",
        confianza: "alta",
        evidencias: [{ sourceRef: "braindump", cita: "hacemos remodelaciones de casas" }],
      },
    ],
    inferidos: [],
    faltantes: [],
    contradicciones: [],
    resumen: "Landing para una constructora que ofrece remodelaciones residenciales.",
  };
}

/** Viola el refine de dominio: un ítem de `confirmados` sin evidencias (pero respeta la FORMA — pasa `contextBriefSchema`). */
function invalidBrief(): ContextBrief {
  return {
    confirmados: [
      {
        titulo: "Rubro",
        detalle: "La empresa se dedica a remodelaciones residenciales.",
        confianza: "alta",
        evidencias: [],
      },
    ],
    inferidos: [],
    faltantes: [],
    contradicciones: [],
    resumen: "Landing para una constructora que ofrece remodelaciones residenciales.",
  };
}

describe("executeOperation", () => {
  it("1. camino feliz: create ok, end_turn, sin domainSchema — persistResult y finishRun(succeeded) 1 vez, tokens correctos", async () => {
    const client = makeClient();
    client.messages.stream.mockReturnValue(asStream(textResponse(validBrief(), { usage: { input_tokens: 120, output_tokens: 340 } })));
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.stream).toHaveBeenCalledTimes(1);
    expect(client.messages.stream.mock.calls[0][0]).toMatchObject({
      model: resolvePixelForgeModel("analyze_context"),
      max_tokens: 8000,
      system: "system prompt",
    });
    expect(callbacks.persistResult).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).toHaveBeenCalledWith(validBrief());
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "succeeded",
        tokensIn: 120,
        tokensOut: 340,
        retryCount: 0,
      })
    );
    expect(result).toEqual({ output: validBrief() });
  });

  it("2. refusal: failureKind refusal, persistResult NO llamado, finishRun(failed) 1 vez", async () => {
    const client = makeClient();
    client.messages.stream.mockReturnValue(asStream({
      stop_reason: "refusal",
      content: [],
      usage: { input_tokens: 15, output_tokens: 0 },
    }));
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.stream).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "refusal" })
    );
    expect(result).toEqual({ failure: "refusal", error: expect.any(String) });
  });

  it("3. max_tokens: failureKind max_tokens, sin retry (create llamado 1 vez), gana aunque el texto truncado pareciera parseable", async () => {
    const client = makeClient();
    client.messages.stream.mockReturnValue(asStream({
      stop_reason: "max_tokens",
      // Texto truncado a media generación — a propósito NO es JSON válido, para probar que
      // stop_reason se clasifica ANTES de intentar leer/parsear el texto (el bug C1 real).
      content: [{ type: "text", text: '{"confirmados": [{"titulo": "Rub' }],
      usage: { input_tokens: 50, output_tokens: 8000 },
    }));
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.stream).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "max_tokens", tokensIn: 50, tokensOut: 8000 })
    );
    expect(result).toEqual({ failure: "max_tokens", error: expect.any(String) });
  });

  it("4. domain_validation con retry exitoso: 1ra respuesta viola domainSchema, 2da válida — retryCount 1, succeeded, create x2, tokens sumados", async () => {
    const client = makeClient();
    client.messages.stream
      .mockReturnValueOnce(asStream(textResponse(invalidBrief(), { usage: { input_tokens: 100, output_tokens: 200 } })))
      .mockReturnValueOnce(asStream(textResponse(validBrief(), { usage: { input_tokens: 130, output_tokens: 90 } })));
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      domainSchema: contextBriefDomainSchema,
      callbacks,
    });

    expect(client.messages.stream).toHaveBeenCalledTimes(2);
    // La 2a llamada reenvía la conversación original + assistant(json) + user(correción).
    const secondCallMessages = client.messages.stream.mock.calls[1][0].messages as Anthropic.MessageParam[];
    expect(secondCallMessages.length).toBe(BASE_MESSAGES.length + 2);
    expect(secondCallMessages[secondCallMessages.length - 2].role).toBe("assistant");
    expect(secondCallMessages[secondCallMessages.length - 1].role).toBe("user");

    expect(callbacks.onProgress).toHaveBeenCalledWith(60, expect.any(String));
    expect(callbacks.persistResult).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).toHaveBeenCalledWith(validBrief());
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "succeeded",
        retryCount: 1,
        tokensIn: 100 + 130,
        tokensOut: 200 + 90,
      })
    );
    expect(result).toEqual({ output: validBrief() });
  });

  it("5. domain_validation doble: failed domain_validation, create llamado exactamente 2 veces (no 3)", async () => {
    const client = makeClient();
    client.messages.stream
      .mockReturnValueOnce(asStream(textResponse(invalidBrief(), { usage: { input_tokens: 100, output_tokens: 200 } })))
      .mockReturnValueOnce(asStream(textResponse(invalidBrief(), { usage: { input_tokens: 110, output_tokens: 210 } })));
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      domainSchema: contextBriefDomainSchema,
      callbacks,
    });

    expect(client.messages.stream).toHaveBeenCalledTimes(2);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failureKind: "domain_validation",
        retryCount: 1,
        tokensIn: 100 + 110,
        tokensOut: 200 + 210,
      })
    );
    expect(result).toMatchObject({ failure: "domain_validation" });
    if ("failure" in result) {
      expect(result.error).toContain("confirmados.0.evidencias");
    }
  });

  it("6. APIError 500 → provider_error, sin retry", async () => {
    const client = makeClient();
    client.messages.stream.mockReturnValueOnce(
      asRejectedStream(new Anthropic.APIError(500, undefined, "Internal server error", undefined))
    );
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.stream).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "provider_error" })
    );
    expect(result).toEqual({ failure: "provider_error", error: expect.any(String) });
  });

  it("7. APIError 400 con mensaje de schema → schema_too_complex, sin retry", async () => {
    const client = makeClient();
    client.messages.stream.mockReturnValueOnce(
      asRejectedStream(new Anthropic.APIError(400, undefined, "Invalid output_config.format: schema too complex", undefined))
    );
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.stream).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "schema_too_complex" })
    );
    expect(result).toEqual({ failure: "schema_too_complex", error: expect.any(String) });
  });

  it("8. timeout (error con name AbortError, duck-typed) → timeout", async () => {
    const client = makeClient();
    client.messages.stream.mockReturnValueOnce(
      asRejectedStream({ name: "AbortError", message: "The operation was aborted." })
    );
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.stream).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "timeout" })
    );
    expect(result).toEqual({ failure: "timeout", error: expect.any(String) });
  });

  it("9. JSON roto con stop_reason end_turn → provider_error, sin retry (la gramática debió garantizar JSON)", async () => {
    const client = makeClient();
    client.messages.stream.mockReturnValueOnce(asStream({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "esto no es JSON" }],
      usage: { input_tokens: 40, output_tokens: 30 },
    }));
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.stream).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "provider_error", retryCount: 0 })
    );
    expect(result).toEqual({ failure: "provider_error", error: expect.any(String) });
  });

  it("10. forma inválida (viola minLength de outputSchema, sin domainSchema) entra al MISMO retry semántico y se recupera", async () => {
    const client = makeClient();
    // `resumen` viola `.min(1)` de `contextBriefSchema` — degradación de forma que la gramática NO
    // garantiza al 100%, debe clasificarse domain_validation y disparar el retry compartido aunque
    // NO se pase `domainSchema` (el shape-check corre siempre, ver `validateOutput` en `./run.ts`).
    const malformed = { ...validBrief(), resumen: "" };
    client.messages.stream
      .mockReturnValueOnce(asStream(textResponse(malformed, { usage: { input_tokens: 90, output_tokens: 150 } })))
      .mockReturnValueOnce(asStream(textResponse(validBrief(), { usage: { input_tokens: 95, output_tokens: 60 } })));
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.stream).toHaveBeenCalledTimes(2);
    expect(callbacks.persistResult).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).toHaveBeenCalledWith(validBrief());
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "succeeded",
        retryCount: 1,
        tokensIn: 90 + 95,
        tokensOut: 150 + 60,
      })
    );
    expect(result).toEqual({ output: validBrief() });
  });
});
