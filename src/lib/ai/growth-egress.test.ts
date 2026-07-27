import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Gate E0c-2 — política de salida de las tres fronteras de IA de Growth.
 *
 * Cuatro niveles:
 *
 *  1. **Política**: el destino sigue siendo el par `proveedor:modelo` y se
 *     compara exacto. Añadir proveedores no relaja nada: un modelo autorizado
 *     para uno no queda autorizado para otro.
 *  2. **Adaptadores** (`./openai-egress`, `./image-egress`): un bloqueo debe
 *     impedir además que se construya el request, que se lea la credencial y
 *     que se instancie el cliente.
 *  3. **Fronteras**: `generateText`, `generateIdeogramImage` y
 *     `generateFluxImage` conservan su contrato y reciben cero llamadas de red
 *     cuando la política bloquea.
 *  4. **Propagación**: un error crudo de proveedor no puede llegar a la base de
 *     datos, a una respuesta HTTP, a una server action ni a `console.error`.
 *
 * Cero red real: SDK y `fetch` mockeados, con aserciones de cero invocaciones.
 */

const { openaiConstructor, chatCompletionsCreate, falCreateClient, falSubscribeMock } = vi.hoisted(
  () => ({
    openaiConstructor: vi.fn(),
    chatCompletionsCreate: vi.fn(),
    falCreateClient: vi.fn(),
    falSubscribeMock: vi.fn(),
  })
);

// El doble sustituye la CLASE, no solo el método: así `openaiConstructor` prueba
// que ni siquiera se llegó a instanciar el cliente. Los estáticos (`APIError`,
// `APIConnectionTimeoutError`) se heredan del real por la cadena de prototipos —
// `openai-egress` los usa para clasificar.
vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openai")>();
  const Real = actual.default;
  class MockOpenAI {
    chat = { completions: { create: chatCompletionsCreate } };
    constructor(options?: unknown) {
      openaiConstructor(options);
    }
  }
  Object.setPrototypeOf(MockOpenAI, Real);
  return { ...actual, default: MockOpenAI };
});

vi.mock("@fal-ai/client", () => ({
  createFalClient: (...args: unknown[]) => {
    falCreateClient(...args);
    return { subscribe: falSubscribeMock };
  },
}));

import { assertAiEgressAllowed, EgressBlockedError } from "@/lib/egress-guard";
import { AiProviderError, SafeUserError, toSafeFailure } from "./errors";
import { openaiChatCreate } from "./openai-egress";
import { ideogramGenerateImage, falSubscribe } from "./image-egress";
import { generateText } from "@/lib/growth/ai/providers/openai-text";
import { generateIdeogramImage } from "@/lib/growth/ai/providers/ideogram-image";
import { generateFluxImage } from "@/lib/growth/ai/providers/flux-image";

// ── Constantes sintéticas ─────────────────────────────────────────────────────

const MODELO_OPENAI = "gpt-4o";
const MODELO_IDEOGRAM = "V_2";
const MODELO_FLUX = "fal-ai/flux/schnell";

const TARGET_OPENAI = `openai:${MODELO_OPENAI}`;
const TARGET_IDEOGRAM = "ideogram:v_2";
const TARGET_FLUX = `fal:${MODELO_FLUX}`;

const PROMPT_SENSIBLE = "Objeciones de ACME: precio alto. Respuesta aprobada: valor a 12 meses.";

const ENV_ORIGINAL = { ...process.env };

function limpiar() {
  for (const clave of Object.keys(process.env)) {
    if (
      clave.startsWith("EGRESS_") ||
      clave === "OPENAI_API_KEY" ||
      clave === "IDEOGRAM_API_KEY" ||
      clave === "FAL_KEY"
    ) {
      delete process.env[clave];
    }
  }
}

/** Entorno con las tres fronteras autorizadas y credenciales sintéticas. */
function autorizarTodo() {
  process.env.EGRESS_AI_MODE = "allowlist";
  process.env.EGRESS_AI_TARGET_ALLOWLIST = [TARGET_OPENAI, TARGET_IDEOGRAM, TARGET_FLUX].join(",");
  process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
  process.env.OPENAI_API_KEY = "sk-sintetica";
  process.env.IDEOGRAM_API_KEY = "clave-sintetica";
  process.env.FAL_KEY = "fal-sintetica";
}

/** Respuesta canónica de OpenAI que satisface el contrato `OpenAIRawResult`. */
const RESPUESTA_OPENAI = {
  choices: [{ message: { content: "texto generado" } }],
  usage: { prompt_tokens: 100, completion_tokens: 50 },
};

/**
 * Ejecuta la llamada y devuelve el error que lanzó. Falla la prueba si resuelve:
 * un `.catch()` inline devolvería la unión con el tipo de éxito y dejaría de
 * comprobar lo que interesa.
 */
async function capturarFallo(fn: () => Promise<unknown>): Promise<AiProviderError> {
  try {
    await fn();
  } catch (e) {
    return e as AiProviderError;
  }
  throw new Error("se esperaba un fallo y la llamada resolvió");
}

function respuestaFetchOk(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  limpiar();
  chatCompletionsCreate.mockResolvedValue(RESPUESTA_OPENAI);
  falSubscribeMock.mockResolvedValue({ data: { images: [{ url: "https://ejemplo/img.png" }] } });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const clave of Object.keys(process.env)) {
    if (!(clave in ENV_ORIGINAL)) delete process.env[clave];
  }
  Object.assign(process.env, ENV_ORIGINAL);
});

// ── 1. Política ───────────────────────────────────────────────────────────────

describe("política — proveedores de Growth", () => {
  it("autoriza el par exacto de cada proveedor", () => {
    autorizarTodo();
    expect(() =>
      assertAiEgressAllowed({ provider: "openai", model: MODELO_OPENAI, operation: "generate_text" })
    ).not.toThrow();
    expect(() =>
      assertAiEgressAllowed({
        provider: "ideogram",
        model: MODELO_IDEOGRAM,
        operation: "generate_image",
      })
    ).not.toThrow();
    expect(() =>
      assertAiEgressAllowed({ provider: "fal", model: MODELO_FLUX, operation: "generate_image" })
    ).not.toThrow();
  });

  it("autoriza cada modelo de fal por separado", () => {
    for (const modelo of ["fal-ai/flux/schnell", "fal-ai/flux/dev", "fal-ai/flux-pro/v1.1"]) {
      limpiar();
      process.env.EGRESS_AI_MODE = "allowlist";
      process.env.EGRESS_AI_TARGET_ALLOWLIST = `fal:${modelo}`;
      process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
      expect(() =>
        assertAiEgressAllowed({ provider: "fal", model: modelo, operation: "generate_image" })
      ).not.toThrow();
    }
  });

  it("el mismo modelo con otro proveedor bloquea", () => {
    limpiar();
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = TARGET_OPENAI;
    process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
    // `gpt-4o` está autorizado para openai; no queda autorizado para anthropic.
    expect(() =>
      assertAiEgressAllowed({
        provider: "anthropic",
        model: MODELO_OPENAI,
        operation: "generate_text",
      })
    ).toThrow(EgressBlockedError);
  });

  it("una coincidencia parcial de modelo no autoriza", () => {
    limpiar();
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = TARGET_OPENAI;
    process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
    for (const modelo of ["gpt-4", "gpt-4o-mini", "gpt"]) {
      expect(() =>
        assertAiEgressAllowed({ provider: "openai", model: modelo, operation: "generate_text" })
      ).toThrow(EgressBlockedError);
    }
  });

  it("una coincidencia parcial de proveedor no autoriza", () => {
    limpiar();
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = "open:gpt-4o,fal-ai:fal-ai/flux/schnell";
    process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
    expect(() =>
      assertAiEgressAllowed({ provider: "openai", model: MODELO_OPENAI, operation: "generate_text" })
    ).toThrow(EgressBlockedError);
    expect(() =>
      assertAiEgressAllowed({ provider: "fal", model: MODELO_FLUX, operation: "generate_image" })
    ).toThrow(EgressBlockedError);
  });

  it("un target no listado bloquea también en producción", () => {
    vi.stubEnv("NODE_ENV", "production");
    limpiar();
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = TARGET_OPENAI;
    expect(() =>
      assertAiEgressAllowed({
        provider: "ideogram",
        model: MODELO_IDEOGRAM,
        operation: "generate_image",
      })
    ).toThrow(EgressBlockedError);
  });

  it("fuera de producción exige el reconocimiento exacto `true`", () => {
    for (const valor of ["1", "yes", "enabled", ""]) {
      limpiar();
      process.env.EGRESS_AI_MODE = "allowlist";
      process.env.EGRESS_AI_TARGET_ALLOWLIST = TARGET_OPENAI;
      process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = valor;
      expect(() =>
        assertAiEgressAllowed({
          provider: "openai",
          model: MODELO_OPENAI,
          operation: "generate_text",
        })
      ).toThrow(EgressBlockedError);
    }
  });

  it("una allowlist vacía bloquea aunque el modo sea válido", () => {
    limpiar();
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
    expect(() =>
      assertAiEgressAllowed({ provider: "openai", model: MODELO_OPENAI, operation: "generate_text" })
    ).toThrow(EgressBlockedError);
  });

  it("habilitar el canal ai no habilita otros canales", async () => {
    autorizarTodo();
    const { assertEgressAllowed } = await import("@/lib/egress-guard");
    expect(() =>
      assertEgressAllowed({ channel: "email", operation: "send", target: "alguien@ejemplo.com" })
    ).toThrow(EgressBlockedError);
    expect(() =>
      assertEgressAllowed({ channel: "r2", operation: "delete", target: "bucket-x" })
    ).toThrow(EgressBlockedError);
  });
});

// ── 2. OpenAI ─────────────────────────────────────────────────────────────────

describe("openai-egress — adaptador", () => {
  it("al bloquear no construye params, ni cliente, ni llama al SDK", async () => {
    limpiar(); // sin EGRESS_AI_MODE → disabled
    const buildParams = vi.fn();

    await expect(
      openaiChatCreate({ operation: "generate_text", model: MODELO_OPENAI, buildParams })
    ).rejects.toThrow(EgressBlockedError);

    expect(buildParams).not.toHaveBeenCalled();
    expect(openaiConstructor).not.toHaveBeenCalled();
    expect(chatCompletionsCreate).not.toHaveBeenCalled();
  });

  it("un modelo no autorizado bloquea sin construir params", async () => {
    autorizarTodo();
    const buildParams = vi.fn();

    await expect(
      openaiChatCreate({ operation: "generate_text", model: "gpt-5-imaginario", buildParams })
    ).rejects.toThrow(EgressBlockedError);

    expect(buildParams).not.toHaveBeenCalled();
    expect(chatCompletionsCreate).not.toHaveBeenCalled();
  });

  it("sin reconocimiento de input fuera de producción bloquea sin construir params", async () => {
    limpiar();
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = TARGET_OPENAI;
    process.env.OPENAI_API_KEY = "sk-sintetica";
    const buildParams = vi.fn();

    await expect(
      openaiChatCreate({ operation: "generate_text", model: MODELO_OPENAI, buildParams })
    ).rejects.toThrow(EgressBlockedError);

    expect(buildParams).not.toHaveBeenCalled();
    expect(openaiConstructor).not.toHaveBeenCalled();
  });

  it("autorizado inyecta el modelo exacto y conserva los params", async () => {
    autorizarTodo();

    await openaiChatCreate({
      operation: "generate_text",
      model: MODELO_OPENAI,
      buildParams: () => ({
        temperature: 0.8,
        messages: [{ role: "user", content: PROMPT_SENSIBLE }],
      }),
    });

    expect(chatCompletionsCreate).toHaveBeenCalledTimes(1);
    expect(chatCompletionsCreate.mock.calls[0][0]).toMatchObject({
      model: MODELO_OPENAI,
      temperature: 0.8,
      messages: [{ role: "user", content: PROMPT_SENSIBLE }],
    });
  });

  it("construye un cliente por llamada — no hay singleton", async () => {
    autorizarTodo();
    const llamar = () =>
      openaiChatCreate({
        operation: "generate_text",
        model: MODELO_OPENAI,
        buildParams: () => ({ messages: [{ role: "user", content: "hola" }] }),
      });

    await llamar();
    await llamar();
    await llamar();

    expect(openaiConstructor).toHaveBeenCalledTimes(3);
  });

  it("sin credencial falla con ai_not_configured y sin instanciar cliente", async () => {
    autorizarTodo();
    delete process.env.OPENAI_API_KEY;

    await expect(
      openaiChatCreate({
        operation: "generate_text",
        model: MODELO_OPENAI,
        buildParams: () => ({ messages: [] }),
      })
    ).rejects.toMatchObject({ code: "ai_not_configured", provider: "openai" });

    expect(openaiConstructor).not.toHaveBeenCalled();
  });

  it("sanea el error del SDK: ni prompt, ni respuesta, ni cuerpo, ni key", async () => {
    autorizarTodo();
    const crudo = Object.assign(
      new Error(
        `400 Invalid request: {"messages":[{"content":"${PROMPT_SENSIBLE}"}]} apiKey=sk-sintetica`
      ),
      { status: 400 }
    );
    chatCompletionsCreate.mockRejectedValueOnce(crudo);

    const err = await capturarFallo(() =>
      openaiChatCreate({
        operation: "generate_text",
        model: MODELO_OPENAI,
        buildParams: () => ({ messages: [{ role: "user", content: PROMPT_SENSIBLE }] }),
      })
    );

    expect(err).toBeInstanceOf(AiProviderError);
    expect(err.message).not.toContain(PROMPT_SENSIBLE);
    expect(err.message).not.toContain("sk-sintetica");
    expect(err.message).not.toContain("Invalid request");
    expect(err.status).toBe(400);
    expect(err.code).toBe("ai_provider_error");
  });

  it("un timeout se clasifica como ai_timeout", async () => {
    autorizarTodo();
    chatCompletionsCreate.mockRejectedValueOnce(
      Object.assign(new Error("socket hang up"), { name: "APIConnectionTimeoutError" })
    );

    const err = await capturarFallo(() =>
      openaiChatCreate({
        operation: "generate_text",
        model: MODELO_OPENAI,
        buildParams: () => ({ messages: [] }),
      })
    );

    expect(err.code).toBe("ai_timeout");
  });
});

describe("frontera generateText", () => {
  it("bloqueada: cero llamadas al SDK y cero cliente", async () => {
    limpiar();

    await expect(
      generateText({ systemPrompt: PROMPT_SENSIBLE, userPrompt: "crea un post" })
    ).rejects.toThrow(EgressBlockedError);

    expect(openaiConstructor).not.toHaveBeenCalled();
    expect(chatCompletionsCreate).not.toHaveBeenCalled();
  });

  it("autorizada: conserva el contrato OpenAIRawResult y los prompts", async () => {
    autorizarTodo();

    const resultado = await generateText({
      systemPrompt: PROMPT_SENSIBLE,
      userPrompt: "crea un post",
    });

    expect(resultado.text).toBe("texto generado");
    expect(resultado.model).toBe(MODELO_OPENAI);
    expect(resultado.tokensUsed).toEqual({ input: 100, output: 50 });
    expect(resultado.cost).toBeCloseTo((100 * 2.5 + 50 * 10) / 1_000_000);
    expect(typeof resultado.generationMs).toBe("number");

    expect(chatCompletionsCreate.mock.calls[0][0]).toMatchObject({
      model: MODELO_OPENAI,
      messages: [
        { role: "system", content: PROMPT_SENSIBLE },
        { role: "user", content: "crea un post" },
      ],
    });
  });
});

// ── 3. Ideogram ───────────────────────────────────────────────────────────────

describe("image-egress — Ideogram", () => {
  it("al bloquear no construye body, no lee credencial y no hace fetch", async () => {
    limpiar();
    const fetchMock = vi.fn();
    const buildBody = vi.fn();

    await expect(
      ideogramGenerateImage({
        model: MODELO_IDEOGRAM,
        buildBody,
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    ).rejects.toThrow(EgressBlockedError);

    expect(buildBody).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un modelo distinto de V_2 bloquea", async () => {
    autorizarTodo();
    const fetchMock = vi.fn();

    await expect(
      ideogramGenerateImage({
        model: "V_3",
        buildBody: () => ({}),
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    ).rejects.toThrow(EgressBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("autoriza sobre ideogram:v_2 normalizando el V_2 real", async () => {
    autorizarTodo();
    const fetchMock = vi.fn(async () => respuestaFetchOk({ data: [{ url: "https://x/y.png" }] }));

    await ideogramGenerateImage({
      model: MODELO_IDEOGRAM,
      buildBody: () => ({ image_request: { model: MODELO_IDEOGRAM } }),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("un error HTTP no lee ni incorpora el cuerpo crudo", async () => {
    autorizarTodo();
    const text = vi.fn(async () => `{"error":"${PROMPT_SENSIBLE}"}`);
    const fetchMock = vi.fn(
      async () => ({ ok: false, status: 422, text, json: vi.fn() }) as unknown as Response
    );

    const err = await capturarFallo(() =>
      ideogramGenerateImage({
        model: MODELO_IDEOGRAM,
        buildBody: () => ({ image_request: { prompt: PROMPT_SENSIBLE } }),
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    );

    expect(err).toBeInstanceOf(AiProviderError);
    expect(text).not.toHaveBeenCalled(); // el cuerpo no se lee: no se puede filtrar
    expect(err.status).toBe(422);
    expect(err.message).not.toContain(PROMPT_SENSIBLE);
  });

  it("el prompt no aparece en un fallo de red", async () => {
    autorizarTodo();
    const fetchMock = vi.fn(async () => {
      throw new Error(`ECONNRESET while sending ${PROMPT_SENSIBLE}`);
    });

    const err = await capturarFallo(() =>
      ideogramGenerateImage({
        model: MODELO_IDEOGRAM,
        buildBody: () => ({ image_request: { prompt: PROMPT_SENSIBLE } }),
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    );

    expect(err.message).not.toContain(PROMPT_SENSIBLE);
    expect(err.code).toBe("ai_provider_error");
  });
});

describe("frontera generateIdeogramImage", () => {
  it("bloqueada: cero fetch", async () => {
    limpiar();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateIdeogramImage({ prompt: PROMPT_SENSIBLE })).rejects.toThrow(
      EgressBlockedError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("autorizada: envía V_2 y devuelve el contrato con ideogram_v2", async () => {
    autorizarTodo();
    const fetchMock = vi.fn(async () => respuestaFetchOk({ data: [{ url: "https://x/y.png" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await generateIdeogramImage({ prompt: PROMPT_SENSIBLE });

    expect(resultado.model).toBe("ideogram_v2");
    expect(resultado.provider).toBe("ideogram");
    expect(resultado.imageUrl).toBe("https://x/y.png");

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(init.body as string);
    expect(body.image_request.model).toBe("V_2");
    expect(body.image_request.prompt).toBe(PROMPT_SENSIBLE);
  });
});

// ── 4. fal / Flux ─────────────────────────────────────────────────────────────

describe("image-egress — fal", () => {
  it("al bloquear no construye input, no lee credencial y no crea cliente", async () => {
    limpiar();
    const buildInput = vi.fn();

    await expect(falSubscribe({ model: MODELO_FLUX, buildInput })).rejects.toThrow(
      EgressBlockedError
    );

    expect(buildInput).not.toHaveBeenCalled();
    expect(falCreateClient).not.toHaveBeenCalled();
    expect(falSubscribeMock).not.toHaveBeenCalled();
  });

  it("un modelo fuera de la allowlist bloquea", async () => {
    limpiar();
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = `fal:${MODELO_FLUX}`;
    process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
    process.env.FAL_KEY = "fal-sintetica";

    await expect(falSubscribe({ model: "fal-ai/flux/dev", buildInput: () => ({}) })).rejects.toThrow(
      EgressBlockedError
    );
    expect(falCreateClient).not.toHaveBeenCalled();
  });

  it("autorizado conserva modelo e input", async () => {
    autorizarTodo();

    await falSubscribe({
      model: MODELO_FLUX,
      buildInput: () => ({ prompt: PROMPT_SENSIBLE, num_images: 1 }),
    });

    expect(falSubscribeMock).toHaveBeenCalledTimes(1);
    expect(falSubscribeMock.mock.calls[0][0]).toBe(MODELO_FLUX);
    expect(falSubscribeMock.mock.calls[0][1]).toEqual({
      input: { prompt: PROMPT_SENSIBLE, num_images: 1 },
    });
  });

  it("sin credencial falla con ai_not_configured y sin crear cliente", async () => {
    autorizarTodo();
    delete process.env.FAL_KEY;

    await expect(falSubscribe({ model: MODELO_FLUX, buildInput: () => ({}) })).rejects.toMatchObject(
      { code: "ai_not_configured", provider: "fal" }
    );

    expect(falCreateClient).not.toHaveBeenCalled();
  });

  it("sanea el error del SDK", async () => {
    autorizarTodo();
    falSubscribeMock.mockRejectedValueOnce(
      new Error(`fal error: prompt rejected -> ${PROMPT_SENSIBLE}`)
    );

    const err = await capturarFallo(() =>
      falSubscribe({
        model: MODELO_FLUX,
        buildInput: () => ({ prompt: PROMPT_SENSIBLE }),
      })
    );

    expect(err).toBeInstanceOf(AiProviderError);
    expect(err.message).not.toContain(PROMPT_SENSIBLE);
    expect(err.provider).toBe("fal");
    expect(err.operation).toBe("generate_image");
  });
});

describe("frontera generateFluxImage", () => {
  it("bloqueada: cero createFalClient y cero subscribe", async () => {
    limpiar();

    await expect(generateFluxImage({ prompt: PROMPT_SENSIBLE })).rejects.toThrow(EgressBlockedError);

    expect(falCreateClient).not.toHaveBeenCalled();
    expect(falSubscribeMock).not.toHaveBeenCalled();
  });

  it("autorizada: conserva modelo, prompt y dimensiones", async () => {
    autorizarTodo();

    const resultado = await generateFluxImage({
      prompt: PROMPT_SENSIBLE,
      width: 512,
      height: 768,
    });

    expect(resultado.model).toBe(MODELO_FLUX);
    expect(resultado.provider).toBe("fal_flux");
    expect(resultado.imageUrl).toBe("https://ejemplo/img.png");

    expect(falSubscribeMock.mock.calls[0][1]).toEqual({
      input: {
        prompt: PROMPT_SENSIBLE,
        image_size: { width: 512, height: 768 },
        num_inference_steps: 4,
        num_images: 1,
      },
    });
  });
});

// ── 5. Propagación ────────────────────────────────────────────────────────────

describe("toSafeFailure — el error crudo no cruza a DB, HTTP, action ni logs", () => {
  const CUERPO_CRUDO = `{"error":{"message":"${PROMPT_SENSIBLE}","key":"sk-sintetica"}}`;

  it("un error desconocido no aporta ni un fragmento de su mensaje", () => {
    const failure = toSafeFailure(new Error(CUERPO_CRUDO), "No se pudo generar el post.");
    expect(failure.code).toBe("internal_error");
    expect(failure.message).toBe("No se pudo generar el post.");
    expect(JSON.stringify(failure)).not.toContain(PROMPT_SENSIBLE);
    expect(JSON.stringify(failure)).not.toContain("sk-sintetica");
  });

  it("un AiProviderError conserva código y status, nunca texto de terceros", () => {
    const failure = toSafeFailure(
      new AiProviderError({
        provider: "openai",
        operation: "generate_text",
        code: "ai_provider_error",
        status: 429,
      }),
      "No se pudo generar el post."
    );
    expect(failure.code).toBe("ai_provider_error");
    expect(failure.status).toBe(429);
    expect(failure.message).toBe("No se pudo generar el post.");
  });

  it("un bloqueo de política se distingue del fallo de proveedor", () => {
    const failure = toSafeFailure(
      new EgressBlockedError({ channel: "ai", operation: "generate_text", reason: "mode_disabled" }),
      "No se pudo generar el post."
    );
    expect(failure.code).toBe("ai_egress_blocked");
    // La razón de política tampoco viaja: describe la configuración.
    expect(failure.message).not.toContain("mode_disabled");
  });

  it("un SafeUserError sí conserva su mensaje: lo redactamos nosotros", () => {
    const failure = toSafeFailure(
      new SafeUserError("Créditos insuficientes. Necesitas 6, tienes 2.", "insufficient_credits"),
      "No se pudo generar el post."
    );
    expect(failure.code).toBe("insufficient_credits");
    expect(failure.message).toBe("Créditos insuficientes. Necesitas 6, tienes 2.");
  });

  it("lo que se persiste en growth_jobs.error es un código, no texto libre", () => {
    // Reproduce la decisión de la ruta: `failure.code` es lo único que se guarda.
    const persistido = toSafeFailure(new Error(CUERPO_CRUDO), "No se pudo generar el post.").code;
    expect(persistido).toBe("internal_error");
    expect(persistido).not.toContain(PROMPT_SENSIBLE);
  });
});
