import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeOperation, type RunCallbacks } from "./run";
import { RUN_PUBLIC_MESSAGES } from "./public-messages";
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

/**
 * Política de egress de IA. Estos tests ejercitan el motor, no la política, así
 * que cada uno arranca con el par `anthropic:<modelo>` explícitamente
 * autorizado. Que haga falta declararlo es el punto: sin estas tres variables
 * el adaptador bloquea y el SDK no se toca (ver el bloque "guarda de egress").
 */
const MODELO_AUTORIZADO = resolvePixelForgeModel("analyze_context");

function limpiarPolitica() {
  for (const clave of Object.keys(process.env)) {
    if (clave.startsWith("EGRESS_")) delete process.env[clave];
  }
}

function autorizarEgress() {
  vi.stubEnv("EGRESS_AI_MODE", "allowlist");
  vi.stubEnv("EGRESS_AI_TARGET_ALLOWLIST", `anthropic:${MODELO_AUTORIZADO}`);
  vi.stubEnv("EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION", "true");
}

beforeEach(() => {
  limpiarPolitica();
  autorizarEgress();
  // E0f-3b: el catch de `callModel` ahora registra en console.error — silenciado
  // para que los tests de fallo del proveedor no ensucien la salida.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  limpiarPolitica();
});

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
      // E0f-3b: antes se aseveraba el texto de Zod ("confirmados.0.evidencias");
      // ese detalle ya solo viaja en el prompt del retry — lo que sale del
      // motor (y se persiste) es el mensaje público fijo.
      expect(result.error).toBe(RUN_PUBLIC_MESSAGES.domain_validation);
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

/**
 * Guarda de egress — lo que importa no es que el motor devuelva un fallo, sino
 * que el SDK reciba CERO invocaciones: ni `stream(...)` ni `finalMessage()`.
 * Una guarda que bloqueara después de abrir el stream no protegería nada.
 */
describe("executeOperation — guarda de egress de IA", () => {
  async function correrConPoliticaBloqueada(): Promise<{
    client: ReturnType<typeof makeClient>;
    callbacks: ReturnType<typeof makeCallbacks>;
    result: Awaited<ReturnType<typeof executeOperation>>;
  }> {
    const client = makeClient();
    // Si por un bug la guarda no bloqueara, esto explotaría de forma ruidosa en
    // vez de devolver una respuesta plausible.
    client.messages.stream.mockImplementation(() => {
      throw new Error("el SDK no debía invocarse con la política bloqueada");
    });
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    return { client, callbacks, result };
  }

  it("sin política (modo ausente) no toca el SDK", async () => {
    limpiarPolitica();

    const { client, callbacks, result } = await correrConPoliticaBloqueada();

    expect(client.messages.stream).not.toHaveBeenCalled();
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "provider_error" })
    );
    expect(result).toMatchObject({ failure: "provider_error" });
  });

  it("modo disabled no toca el SDK", async () => {
    limpiarPolitica();
    vi.stubEnv("EGRESS_AI_MODE", "disabled");
    vi.stubEnv("EGRESS_AI_TARGET_ALLOWLIST", `anthropic:${MODELO_AUTORIZADO}`);
    vi.stubEnv("EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION", "true");

    const { client } = await correrConPoliticaBloqueada();

    expect(client.messages.stream).not.toHaveBeenCalled();
  });

  it("modelo distinto al autorizado no toca el SDK", async () => {
    vi.stubEnv("EGRESS_AI_TARGET_ALLOWLIST", "anthropic:otro-modelo-cualquiera");

    const { client } = await correrConPoliticaBloqueada();

    expect(client.messages.stream).not.toHaveBeenCalled();
  });

  it("sin reconocimiento de input fuera de producción no toca el SDK", async () => {
    vi.stubEnv("EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION", "");

    const { client } = await correrConPoliticaBloqueada();

    expect(client.messages.stream).not.toHaveBeenCalled();
  });

  it("la existencia de ANTHROPIC_API_KEY no habilita nada", async () => {
    limpiarPolitica();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-falsa-para-test");

    const { client } = await correrConPoliticaBloqueada();

    expect(client.messages.stream).not.toHaveBeenCalled();
  });

  it("el retry semántico vuelve a atravesar la guarda: si la política se revoca entre llamadas, la segunda no sale", async () => {
    const client = makeClient();
    // La 1ra respuesta viola el dominio (dispara el retry) y, al resolverse,
    // revoca la autorización. Si el retry NO reevaluara la política, habría una
    // 2da llamada al SDK con el egress ya cerrado.
    client.messages.stream.mockReturnValueOnce({
      finalMessage: vi.fn(async () => {
        delete process.env.EGRESS_AI_TARGET_ALLOWLIST;
        return textResponse(invalidBrief(), { usage: { input_tokens: 100, output_tokens: 200 } });
      }),
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

    expect(client.messages.stream).toHaveBeenCalledTimes(1);
    expect(callbacks.persistResult).not.toHaveBeenCalled();
    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureKind: "provider_error", retryCount: 1 })
    );
    expect(result).toMatchObject({ failure: "provider_error" });
  });

  it("los errores que salen del motor no citan el modelo ni el target completo", async () => {
    limpiarPolitica();

    const { result } = await correrConPoliticaBloqueada();

    expect("failure" in result).toBe(true);
    if ("failure" in result) {
      expect(result.error).not.toContain(MODELO_AUTORIZADO);
      expect(result.error).not.toContain(`anthropic:${MODELO_AUTORIZADO}`);
    }
  });
});

/**
 * E0f-3b: `RunResult.error` es siempre un mensaje público fijo. Antes el catch
 * de `callModel` propagaba `err.message` del SDK a `finishRun` (y de ahí a
 * `pixelforgeAiRuns.error`, que el poller sirve y la UI muestra en toasts).
 */
describe("executeOperation — lo persistido vía finishRun no lleva texto crudo (E0f-3b)", () => {
  const TOKEN_PRIVADO = "sk-ant-api03-tokenprivadodeanthropic";
  const PROVIDER_BODY = '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}';

  it("un throw del SDK persiste el mensaje fijo de su kind, conservando taxonomía, tokens y duración", async () => {
    const client = makeClient();
    client.messages.stream.mockReturnValue(
      asRejectedStream(
        Object.assign(new Error(`500 ${PROVIDER_BODY} key=${TOKEN_PRIVADO}`), { status: 500 })
      )
    );
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(callbacks.finishRun).toHaveBeenCalledTimes(1);
    const cierre = callbacks.finishRun.mock.calls[0][0];
    expect(cierre).toMatchObject({
      status: "failed",
      failureKind: "provider_error",
      error: RUN_PUBLIC_MESSAGES.provider_error,
      tokensIn: 0,
      tokensOut: 0,
      retryCount: 0,
    });
    expect(typeof cierre.durationMs).toBe("number");

    const registrado = JSON.stringify(callbacks.finishRun.mock.calls);
    expect(registrado).not.toContain(TOKEN_PRIVADO);
    expect(registrado).not.toContain("invalid x-api-key");
    expect(result).toEqual({ failure: "provider_error", error: RUN_PUBLIC_MESSAGES.provider_error });
  });

  it("un timeout conserva su kind y recibe su mensaje fijo, no el message del abort", async () => {
    const client = makeClient();
    client.messages.stream.mockReturnValue(
      asRejectedStream(Object.assign(new Error(`aborted ${TOKEN_PRIVADO}`), { name: "AbortError" }))
    );
    const callbacks = makeCallbacks();

    await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      callbacks,
    });

    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({ failureKind: "timeout", error: RUN_PUBLIC_MESSAGES.timeout })
    );
  });

  it("domain_validation final persiste el mensaje fijo, no los issues de Zod con la salida del modelo", async () => {
    const client = makeClient();
    // Primera respuesta y retry violan el refine de dominio (evidencias vacías).
    client.messages.stream
      .mockReturnValueOnce(asStream(textResponse(invalidBrief())))
      .mockReturnValueOnce(asStream(textResponse(invalidBrief())));
    const callbacks = makeCallbacks();

    const result = await executeOperation({
      client: client as unknown as Anthropic,
      operation: "analyze_context",
      system: "system prompt",
      messages: BASE_MESSAGES,
      domainSchema: contextBriefDomainSchema,
      callbacks,
    });

    expect(callbacks.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failureKind: "domain_validation",
        error: RUN_PUBLIC_MESSAGES.domain_validation,
        retryCount: 1,
      })
    );
    // El texto de Zod (paths/valores de la salida) no cruza a la persistencia…
    const registrado = JSON.stringify(callbacks.finishRun.mock.calls);
    expect(registrado).not.toContain("confirmados");
    expect(registrado).not.toContain("evidencias");
    // …pero el retry semántico SÍ recibió el detalle en el prompt (uso interno).
    const promptRetry = JSON.stringify(client.messages.stream.mock.calls[1][0]);
    expect(promptRetry).toContain("evidencias");
    expect(result).toEqual({
      failure: "domain_validation",
      error: RUN_PUBLIC_MESSAGES.domain_validation,
    });
  });
});
