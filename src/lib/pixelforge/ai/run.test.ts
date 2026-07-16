import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { executeOperation, type RunCallbacks } from "./run";
import { contextBriefDomainSchema, type ContextBrief } from "../schemas/analyze-context";
import { resolvePixelForgeModel } from "./model";

/** Cliente mockeado: solo necesitamos `messages.parse`, ver brief F2-T3. */
function makeClient() {
  return { messages: { parse: vi.fn() } };
}

function makeCallbacks() {
  return {
    onProgress: vi.fn().mockResolvedValue(undefined),
    persistResult: vi.fn().mockResolvedValue(undefined),
    finishRun: vi.fn().mockResolvedValue(undefined),
  } satisfies RunCallbacks & Record<string, ReturnType<typeof vi.fn>>;
}

const BASE_MESSAGES: Anthropic.MessageParam[] = [{ role: "user", content: "Analiza este proyecto." }];

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

/** Viola el refine de dominio: un ítem de `confirmados` sin evidencias. */
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
  it("1. camino feliz: parse ok, end_turn, sin domainSchema — persistResult y finishRun(succeeded) 1 vez, tokens correctos", async () => {
    const client = makeClient();
    client.messages.parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: validBrief(),
      usage: { input_tokens: 120, output_tokens: 340 },
    });
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.parse).toHaveBeenCalledTimes(1);
    expect(client.messages.parse.mock.calls[0][0]).toMatchObject({
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
    client.messages.parse.mockResolvedValue({
      stop_reason: "refusal",
      parsed_output: null,
      usage: { input_tokens: 15, output_tokens: 0 },
    });
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.parse).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "refusal" })
    );
    expect(result).toEqual({ failure: "refusal", error: expect.any(String) });
  });

  it("3. max_tokens: failureKind max_tokens, sin retry (parse llamado 1 vez)", async () => {
    const client = makeClient();
    client.messages.parse.mockResolvedValue({
      stop_reason: "max_tokens",
      parsed_output: null,
      usage: { input_tokens: 50, output_tokens: 8000 },
    });
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.parse).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "max_tokens" })
    );
    expect(result).toEqual({ failure: "max_tokens", error: expect.any(String) });
  });

  it("4. domain_validation con retry exitoso: 1ra respuesta viola domainSchema, 2da válida — retryCount 1, succeeded, parse x2, tokens sumados", async () => {
    const client = makeClient();
    client.messages.parse
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        parsed_output: invalidBrief(),
        usage: { input_tokens: 100, output_tokens: 200 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        parsed_output: validBrief(),
        usage: { input_tokens: 130, output_tokens: 90 },
      });
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      domainSchema: contextBriefDomainSchema,
      callbacks,
    });

    expect(client.messages.parse).toHaveBeenCalledTimes(2);
    // La 2a llamada reenvía la conversación original + assistant(json) + user(correción).
    const secondCallMessages = client.messages.parse.mock.calls[1][0].messages as Anthropic.MessageParam[];
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

  it("5. domain_validation doble: failed domain_validation, parse llamado exactamente 2 veces (no 3)", async () => {
    const client = makeClient();
    client.messages.parse
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        parsed_output: invalidBrief(),
        usage: { input_tokens: 100, output_tokens: 200 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        parsed_output: invalidBrief(),
        usage: { input_tokens: 110, output_tokens: 210 },
      });
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      domainSchema: contextBriefDomainSchema,
      callbacks,
    });

    expect(client.messages.parse).toHaveBeenCalledTimes(2);
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
    client.messages.parse.mockRejectedValueOnce(
      new Anthropic.APIError(500, undefined, "Internal server error", undefined)
    );
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.parse).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "provider_error" })
    );
    expect(result).toEqual({ failure: "provider_error", error: expect.any(String) });
  });

  it("7. APIError 400 con mensaje de schema → schema_too_complex, sin retry", async () => {
    const client = makeClient();
    client.messages.parse.mockRejectedValueOnce(
      new Anthropic.APIError(400, undefined, "Invalid output_config.format: schema too complex", undefined)
    );
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.parse).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "schema_too_complex" })
    );
    expect(result).toEqual({ failure: "schema_too_complex", error: expect.any(String) });
  });

  it("8. timeout (error con name AbortError, duck-typed) → timeout", async () => {
    const client = makeClient();
    client.messages.parse.mockRejectedValueOnce({ name: "AbortError", message: "The operation was aborted." });
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(client.messages.parse).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "timeout" })
    );
    expect(result).toEqual({ failure: "timeout", error: expect.any(String) });
  });
});
