import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Gate E0c-1 — política de salida hacia Anthropic.
 *
 * Tres niveles:
 *
 *  1. **Política** (`assertAiEgressAllowed`): el destino es el par
 *     `proveedor:modelo` y se compara exacto; fuera de producción hace falta un
 *     reconocimiento extra para enviar input real.
 *  2. **Adaptador** (`@/lib/ai/anthropic-egress`): un bloqueo debe impedir
 *     además que se construya el payload y que se instancie el cliente. Una
 *     guarda que corriera después de armar el prompt no protegería nada.
 *  3. **Fronteras**: cada ruta/función que hace inferencia recibe cero
 *     invocaciones del SDK cuando la política bloquea.
 *
 * Cero red real: el SDK está mockeado y se comprueba que reciba cero llamadas.
 */

const { anthropicConstructor, messagesCreate, messagesStream, finalMessage } = vi.hoisted(() => ({
  anthropicConstructor: vi.fn(),
  messagesCreate: vi.fn(),
  messagesStream: vi.fn(),
  finalMessage: vi.fn(),
}));

// El doble sustituye la CLASE, no solo los métodos: así `anthropicConstructor`
// prueba que ni siquiera se llegó a instanciar el cliente. Los estáticos
// (`APIError`, `APIConnectionTimeoutError`…) se heredan del real vía la cadena
// de prototipos — `anthropic-egress` y `ai/failures` los usan para clasificar.
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  const Real = actual.default;
  class MockAnthropic {
    messages = { create: messagesCreate, stream: messagesStream };
    constructor(options?: unknown) {
      anthropicConstructor(options);
    }
  }
  Object.setPrototypeOf(MockAnthropic, Real);
  return { ...actual, default: MockAnthropic };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "cookie-sintetica" }) })),
}));

vi.mock("@/lib/vpsClient", () => ({
  requireSession: vi.fn(async () => ({ ok: true })),
}));

const { authMock, getClientByIdMock, getDefinitionFullMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getClientByIdMock: vi.fn(),
  getDefinitionFullMock: vi.fn(),
}));

vi.mock("@/lib/auth/config", () => ({ auth: authMock }));
vi.mock("@/lib/db/repos/crm", () => ({ getClientById: getClientByIdMock }));
vi.mock("@/lib/db/repos/definitions", () => ({
  getDefinitionFull: getDefinitionFullMock,
  appendMessage: vi.fn(async () => undefined),
  updateStationDraft: vi.fn(async () => undefined),
}));

import { assertAiEgressAllowed, EgressBlockedError, assertEgressAllowed } from "@/lib/egress-guard";
import { anthropicCreate, anthropicStreamFinalMessage, AiProviderError } from "./anthropic-egress";
import { parseModelJson, ModelResponseFormatError } from "./model-json";
import { POST as postSessionSummary } from "@/app/api/workspace/session-summary/route";
import { POST as postAiPrompt } from "@/app/api/workspace/ai-prompt/route";
import { POST as postProposal } from "@/app/api/documents/proposal-generate/route";
import { POST as postWelcome } from "@/app/api/documents/welcome-generate/route";
import { POST as postDiscovery } from "@/app/api/documents/discovery-generate/route";
import { POST as postDefinition } from "@/app/api/definition/generate/route";
import { generatePostFromBrief } from "@/lib/blog/ai/generate-post";
import type { WorkSession } from "@/types/session";
import type { BlogBriefDoc } from "@/lib/blog/types";

// ── Constantes sintéticas ─────────────────────────────────────────────────────

const MODELO_RUTAS = "modelo-sintetico-rutas";
const MODELO_DEFINICION = "modelo-sintetico-definicion";
const DEFINITION_ID = "33333333-3333-3333-3333-333333333333";
const CLIENT_ID = "44444444-4444-4444-4444-444444444444";

const ENV_ORIGINAL = { ...process.env };

function limpiar() {
  for (const clave of Object.keys(process.env)) {
    if (clave.startsWith("EGRESS_") || clave.startsWith("ANTHROPIC_") || clave === "DEFINITION_AI_MODEL") {
      delete process.env[clave];
    }
  }
}

/** Respuesta canónica: JSON que satisface a los parsers de todas las fronteras. */
const RESPUESTA_OK = {
  stop_reason: "end_turn",
  content: [
    {
      type: "text",
      text: '{"summary":"s","bitacoraEntry":"b","nextStep":"n","solution":"so","deliverables":"d","benefits":"be","questions":[]}',
    },
  ],
  usage: { input_tokens: 1, output_tokens: 1 },
};

beforeEach(() => {
  limpiar();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ANTHROPIC_MODEL", MODELO_RUTAS);
  vi.stubEnv("DEFINITION_AI_MODEL", MODELO_DEFINICION);
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-sintetica-de-prueba");

  anthropicConstructor.mockClear();
  messagesCreate.mockReset().mockResolvedValue(RESPUESTA_OK);
  finalMessage.mockReset().mockResolvedValue(RESPUESTA_OK);
  messagesStream.mockReset().mockReturnValue({ finalMessage });

  authMock.mockReset().mockResolvedValue({ user: { id: "owner-1" } });
  getClientByIdMock.mockReset().mockResolvedValue({ id: CLIENT_ID, name: "Cliente Sintético" });
  getDefinitionFullMock.mockReset().mockResolvedValue({
    definition: {
      id: DEFINITION_ID,
      status: "active",
      currentStation: "boceto",
      brainDump: "Descarga mental sintética para la prueba.",
      clientId: CLIENT_ID,
    },
    stations: [{ station: "boceto", status: "active", sealedContent: null }],
    messages: [],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const clave of Object.keys(process.env)) {
    if (!(clave in ENV_ORIGINAL)) delete process.env[clave];
  }
  Object.assign(process.env, ENV_ORIGINAL);
});

/** Autoriza el par exacto indicado, en modo allowlist y con reconocimiento de input. */
function permitir(...modelos: string[]) {
  process.env.EGRESS_AI_MODE = "allowlist";
  process.env.EGRESS_AI_TARGET_ALLOWLIST = modelos.map((m) => `anthropic:${m}`).join(",");
  process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
}

const pedir = (model = MODELO_RUTAS) =>
  assertAiEgressAllowed({ provider: "anthropic", model, operation: "generate_text" });

// ── 1. Política ───────────────────────────────────────────────────────────────

describe("ai — política", () => {
  it("sin ninguna variable bloquea", () => {
    expect(() => pedir()).toThrow(EgressBlockedError);
    expect(() => pedir()).toThrow(/mode_disabled/);
  });

  it("modo vacío bloquea", () => {
    process.env.EGRESS_AI_MODE = "";
    expect(() => pedir()).toThrow(/mode_invalid/);
  });

  it("modo desconocido bloquea", () => {
    process.env.EGRESS_AI_MODE = "enabled";
    expect(() => pedir()).toThrow(/mode_invalid/);
  });

  it("modo disabled bloquea", () => {
    process.env.EGRESS_AI_MODE = "disabled";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = `anthropic:${MODELO_RUTAS}`;
    process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
    expect(() => pedir()).toThrow(/mode_disabled/);
  });

  it("que exista ANTHROPIC_API_KEY no habilita nada", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-otra-clave-sintetica";
    expect(() => pedir()).toThrow(/mode_disabled/);
  });

  it("allowlist vacía bloquea", () => {
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
    expect(() => pedir()).toThrow(/allowlist_empty/);
  });

  it("modelo vacío bloquea", () => {
    permitir(MODELO_RUTAS);
    expect(() => pedir("   ")).toThrow(/target_missing/);
  });

  it("target exacto pasa", () => {
    permitir(MODELO_RUTAS);
    expect(() => pedir(MODELO_RUTAS)).not.toThrow();
  });

  it("un modelo distinto al autorizado bloquea", () => {
    permitir("modelo-a");
    expect(() => pedir("modelo-b")).toThrow(/target_not_allowed/);
  });

  it("coincidencia parcial bloqueada: un prefijo autorizado no autoriza el modelo largo", () => {
    permitir("claude-haiku-4-5");
    expect(() => pedir("claude-haiku-4-5-20251001")).toThrow(/target_not_allowed/);
  });

  it("coincidencia parcial bloqueada: el modelo largo autorizado no autoriza el prefijo", () => {
    permitir("claude-haiku-4-5-20251001");
    expect(() => pedir("claude-haiku-4-5")).toThrow(/target_not_allowed/);
  });

  it("el par es proveedor:modelo, no dos listas: el mismo modelo bajo otro proveedor no autoriza", () => {
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = "openai:modelo-compartido";
    process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
    expect(() => pedir("modelo-compartido")).toThrow(/target_not_allowed/);
  });

  it("habilitar IA no habilita otros canales", () => {
    permitir(MODELO_RUTAS);
    expect(() => pedir()).not.toThrow();
    expect(() => assertEgressAllowed({ channel: "email", operation: "send", target: "x@y.z" })).toThrow(
      /mode_disabled/
    );
    expect(() => assertEgressAllowed({ channel: "meta", operation: "publish" })).toThrow(
      /mode_disabled/
    );
  });

  it("fuera de producción, sin reconocimiento de input, bloquea aunque el target esté autorizado", () => {
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = `anthropic:${MODELO_RUTAS}`;
    expect(() => pedir()).toThrow(/input_not_authorized/);
  });

  it("solo `true` (tras trim+lowercase) reconoce el input; 1/yes/enabled no", () => {
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = `anthropic:${MODELO_RUTAS}`;

    for (const valor of ["1", "yes", "enabled", "sí", "truthy"]) {
      process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = valor;
      expect(() => pedir()).toThrow(/input_not_authorized/);
    }

    process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
    expect(() => pedir()).not.toThrow();
  });

  it("live fuera de producción conserva el reconocimiento general existente", () => {
    process.env.EGRESS_AI_MODE = "live";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = `anthropic:${MODELO_RUTAS}`;
    process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
    expect(() => pedir()).toThrow(/live_outside_production/);

    process.env.EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION = "true";
    expect(() => pedir()).not.toThrow();
  });

  it("en producción, live con target NO listado sigue bloqueando", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.EGRESS_AI_MODE = "live";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = "anthropic:otro-modelo";
    expect(() => pedir()).toThrow(/target_not_allowed/);
  });

  it("en producción, live con target listado pasa sin reconocimiento de input", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.EGRESS_AI_MODE = "live";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = `anthropic:${MODELO_RUTAS}`;
    expect(() => pedir()).not.toThrow();
  });

  it("en producción, allowlist vacía sigue bloqueando", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.EGRESS_AI_MODE = "allowlist";
    expect(() => pedir()).toThrow(/allowlist_empty/);
  });

  it("el error no cita el modelo ni el target completo", () => {
    permitir("modelo-a");
    try {
      pedir("modelo-secreto-b");
      throw new Error("debió bloquear");
    } catch (err) {
      expect(err).toBeInstanceOf(EgressBlockedError);
      const mensaje = (err as Error).message;
      expect(mensaje).not.toContain("modelo-secreto-b");
      expect(mensaje).toContain("ai/generate_text");
      expect(mensaje).toContain("target_not_allowed");
    }
  });
});

// ── 2. Adaptador ──────────────────────────────────────────────────────────────

describe("anthropic-egress — adaptador", () => {
  it("al bloquear no ejecuta la fábrica de parámetros, no construye cliente y no llama al SDK", async () => {
    const buildParams = vi.fn(() => ({ max_tokens: 10, messages: [] }));

    await expect(
      anthropicCreate({ operation: "generate_text", model: MODELO_RUTAS, buildParams })
    ).rejects.toBeInstanceOf(EgressBlockedError);

    expect(buildParams).not.toHaveBeenCalled();
    expect(anthropicConstructor).not.toHaveBeenCalled();
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("al bloquear en streaming no crea el stream ni espera finalMessage", async () => {
    const buildParams = vi.fn(() => ({ max_tokens: 10, messages: [] }));

    await expect(
      anthropicStreamFinalMessage({ operation: "analyze", model: MODELO_RUTAS, buildParams })
    ).rejects.toBeInstanceOf(EgressBlockedError);

    expect(buildParams).not.toHaveBeenCalled();
    expect(anthropicConstructor).not.toHaveBeenCalled();
    expect(messagesStream).not.toHaveBeenCalled();
    expect(finalMessage).not.toHaveBeenCalled();
  });

  it("autorizado: ejecuta la fábrica, construye cliente y envía el modelo SIN alterar", async () => {
    const modeloConMayusculas = "Modelo-Mixto-5";
    // La allowlist se normaliza a minúsculas; el modelo que viaja al SDK NO.
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = "anthropic:modelo-mixto-5";
    process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";

    const buildParams = vi.fn(() => ({ max_tokens: 42, messages: [] }));
    await anthropicCreate({ operation: "generate_text", model: modeloConMayusculas, buildParams });

    expect(buildParams).toHaveBeenCalledTimes(1);
    expect(anthropicConstructor).toHaveBeenCalledTimes(1);
    expect(messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: modeloConMayusculas, max_tokens: 42 })
    );
  });

  it("autorizado en streaming: espera finalMessage DENTRO del wrapper", async () => {
    permitir(MODELO_RUTAS);

    const resultado = await anthropicStreamFinalMessage({
      operation: "analyze",
      model: MODELO_RUTAS,
      buildParams: () => ({ max_tokens: 7, messages: [] }),
    });

    expect(messagesStream).toHaveBeenCalledTimes(1);
    expect(finalMessage).toHaveBeenCalledTimes(1);
    expect(resultado).toBe(RESPUESTA_OK);
  });

  it("sin ANTHROPIC_API_KEY falla como ai_not_configured sin instanciar el SDK", async () => {
    permitir(MODELO_RUTAS);
    delete process.env.ANTHROPIC_API_KEY;

    const error = await anthropicCreate({
      operation: "generate_text",
      model: MODELO_RUTAS,
      buildParams: () => ({ max_tokens: 1, messages: [] }),
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AiProviderError);
    expect((error as AiProviderError).code).toBe("ai_not_configured");
    expect(anthropicConstructor).not.toHaveBeenCalled();
  });
});

describe("anthropic-egress — saneamiento de errores", () => {
  beforeEach(() => permitir(MODELO_RUTAS));

  async function fallarCon(err: unknown): Promise<AiProviderError> {
    messagesCreate.mockRejectedValueOnce(err);
    const capturado = (await anthropicCreate({
      operation: "generate_text",
      model: MODELO_RUTAS,
      buildParams: () => ({
        max_tokens: 1,
        messages: [{ role: "user" as const, content: "PROMPT-CONFIDENCIAL-DEL-CLIENTE" }],
      }),
    }).catch((e: unknown) => e)) as AiProviderError;
    expect(capturado).toBeInstanceOf(AiProviderError);
    return capturado;
  }

  it("APIError 500 → ai_provider_error con status, sin el mensaje crudo", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const error = await fallarCon(
      new Anthropic.APIError(500, undefined, "Internal server error: PROMPT-CONFIDENCIAL-DEL-CLIENTE", undefined)
    );

    expect(error.code).toBe("ai_provider_error");
    expect(error.status).toBe(500);
    expect(error.message).not.toContain("PROMPT-CONFIDENCIAL-DEL-CLIENTE");
    expect(error.message).not.toContain(MODELO_RUTAS);
  });

  it("APIError 400 con mensaje de schema → ai_schema_rejected", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const error = await fallarCon(
      new Anthropic.APIError(400, undefined, "Invalid output_config.format: schema too complex", undefined)
    );

    expect(error.code).toBe("ai_schema_rejected");
    expect(error.status).toBe(400);
  });

  it("AbortError duck-typed → ai_timeout", async () => {
    const error = await fallarCon({ name: "AbortError", message: "The operation was aborted." });
    expect(error.code).toBe("ai_timeout");
  });

  it("error desconocido → ai_provider_error sin filtrar su texto", async () => {
    const error = await fallarCon(new Error("boom: PROMPT-CONFIDENCIAL-DEL-CLIENTE"));
    expect(error.code).toBe("ai_provider_error");
    expect(error.message).not.toContain("PROMPT-CONFIDENCIAL-DEL-CLIENTE");
  });
});

describe("parseModelJson — la respuesta del modelo no se filtra al error", () => {
  /** Hay bloque `{...}`, pero su contenido no es JSON válido y cita al cliente. */
  const RESPUESTA_CON_DATOS = '{"cliente": CLIENTE-CONFIDENCIAL, "nota": sin comillas}';

  it("texto sin bloque JSON → error sin fragmentos del texto", () => {
    const err = (() => {
      try {
        parseModelJson("sin llaves, solo prosa sobre CLIENTE-CONFIDENCIAL");
        return null;
      } catch (e) {
        return e as Error;
      }
    })();

    expect(err).toBeInstanceOf(ModelResponseFormatError);
    expect(err?.message).not.toContain("CLIENTE-CONFIDENCIAL");
    expect(err?.message).toBe("MODEL_RESPONSE_FORMAT: no_json_block");
  });

  it("bloque JSON inválido → error sin el fragmento que V8 sí incrustaría", () => {
    // Referencia: `JSON.parse` nativo produce
    // `Unexpected token 'e', "esto no es"... is not valid JSON`.
    const nativo = (() => {
      try {
        JSON.parse(RESPUESTA_CON_DATOS);
        return "";
      } catch (e) {
        return (e as Error).message;
      }
    })();
    expect(nativo).toContain("is not valid JSON");

    const err = (() => {
      try {
        parseModelJson(RESPUESTA_CON_DATOS);
        return null;
      } catch (e) {
        return e as Error;
      }
    })();

    expect(err).toBeInstanceOf(ModelResponseFormatError);
    expect(err?.message).toBe("MODEL_RESPONSE_FORMAT: invalid_json");
    expect(err?.message).not.toContain("CLIENTE-CONFIDENCIAL");
  });

  it("respuesta válida se parsea igual que antes", () => {
    expect(parseModelJson<{ a: number }>('bla bla {"a":1} cierre')).toEqual({ a: 1 });
  });
});

// ── 3. Fronteras ──────────────────────────────────────────────────────────────

function sesionSintetica(): WorkSession {
  return {
    projectName: "Proyecto Sintético",
    clientName: "Cliente Sintético",
    taskName: "Tarea Sintética",
    durationSeconds: 600,
    activities: [{ description: "Actividad", completedAt: "2026-01-01T00:00:00.000Z" }],
    sessionGoals: [{ text: "Objetivo", completed: true }],
    notes: [{ type: "nota", content: "Observación" }],
    blockers: [],
    deployStatus: "no",
    commitStatus: true,
  } as unknown as WorkSession;
}

function pedirRuta(url: string, body: unknown): NextRequest {
  return new NextRequest(url, { method: "POST", body: JSON.stringify(body) });
}

const BRIEF_BLOG = {
  topic: "Tema sintético",
  angle: "Ángulo sintético",
  targetAudience: "Audiencia sintética",
  keyPoints: ["Punto 1"],
  tone: "técnico",
} as unknown as BlogBriefDoc;

interface Frontera {
  nombre: string;
  modelo: string;
  invocar: () => Promise<unknown>;
}

const FRONTERAS: Frontera[] = [
  {
    nombre: "workspace/session-summary",
    modelo: MODELO_RUTAS,
    invocar: () =>
      postSessionSummary(
        pedirRuta("http://localhost/api/workspace/session-summary", { session: sesionSintetica() })
      ),
  },
  {
    nombre: "workspace/ai-prompt",
    modelo: MODELO_RUTAS,
    invocar: () =>
      postAiPrompt(
        pedirRuta("http://localhost/api/workspace/ai-prompt", {
          session: sesionSintetica(),
          promptKey: "resumen",
        })
      ),
  },
  {
    nombre: "documents/proposal-generate",
    modelo: MODELO_RUTAS,
    invocar: () =>
      postProposal(
        pedirRuta("http://localhost/api/documents/proposal-generate", {
          clientName: "Cliente Sintético",
          scope: "Alcance sintético",
        })
      ),
  },
  {
    nombre: "documents/welcome-generate",
    modelo: MODELO_RUTAS,
    invocar: () =>
      postWelcome(
        pedirRuta("http://localhost/api/documents/welcome-generate", {
          clientName: "Cliente Sintético",
          serviceDescription: "Servicio sintético",
        })
      ),
  },
  {
    nombre: "documents/discovery-generate",
    modelo: MODELO_RUTAS,
    invocar: () =>
      postDiscovery(
        pedirRuta("http://localhost/api/documents/discovery-generate", { industry: "Industria" })
      ),
  },
  {
    nombre: "definition/generate",
    modelo: MODELO_DEFINICION,
    invocar: () =>
      postDefinition(
        pedirRuta("http://localhost/api/definition/generate", {
          definitionId: DEFINITION_ID,
          station: "boceto",
        })
      ),
  },
  {
    nombre: "blog/ai/generate-post",
    modelo: MODELO_RUTAS,
    invocar: () => generatePostFromBrief(BRIEF_BLOG),
  },
];

describe.each(FRONTERAS)("frontera $nombre", ({ modelo, invocar }) => {
  /** Las rutas capturan y devuelven 500; `generate-post` propaga. Ambas valen. */
  const correr = () =>
    invocar().then(
      () => undefined,
      () => undefined
    );

  it("modo disabled → cero llamadas al SDK y cero clientes construidos", async () => {
    process.env.EGRESS_AI_MODE = "disabled";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = `anthropic:${modelo}`;
    process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";

    await correr();

    expect(messagesCreate).not.toHaveBeenCalled();
    expect(messagesStream).not.toHaveBeenCalled();
    expect(anthropicConstructor).not.toHaveBeenCalled();
  });

  it("modelo no permitido → cero llamadas al SDK", async () => {
    permitir("modelo-que-no-es-el-de-esta-frontera");

    await correr();

    expect(messagesCreate).not.toHaveBeenCalled();
    expect(anthropicConstructor).not.toHaveBeenCalled();
  });

  it("sin reconocimiento de input fuera de producción → cero llamadas al SDK", async () => {
    process.env.EGRESS_AI_MODE = "allowlist";
    process.env.EGRESS_AI_TARGET_ALLOWLIST = `anthropic:${modelo}`;

    await correr();

    expect(messagesCreate).not.toHaveBeenCalled();
    expect(anthropicConstructor).not.toHaveBeenCalled();
  });

  it("configuración autorizada → la llamada llega al mock con el modelo exacto", async () => {
    permitir(modelo);

    await correr();

    expect(messagesCreate).toHaveBeenCalledTimes(1);
    expect(messagesCreate).toHaveBeenCalledWith(expect.objectContaining({ model: modelo }));
    expect(anthropicConstructor).toHaveBeenCalledTimes(1);
  });
});
