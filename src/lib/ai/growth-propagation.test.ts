import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Gate E0c-2 — propagación de errores en las superficies que los exponen.
 *
 * Aquí no se prueba el helper: se ejecutan el **handler HTTP real** y la
 * **server action real**, con un proveedor que falla con un error crudo cargado
 * de marcadores. Lo que se comprueba es lo que cruza hacia fuera —la fila de
 * `growth_jobs`, el cuerpo de la respuesta y el valor devuelto por la action—,
 * porque es ahí donde el cuerpo de un proveedor acababa antes de este gate.
 *
 * El orquestador se prueba aparte (`./growth-orchestrator-propagation.test.ts`):
 * necesita la función real, y aquí está mockeada.
 */

// ── Marcadores que NUNCA deben salir ─────────────────────────────────────────

const MARCADORES = [
  "RAW_PROVIDER_BODY",
  "CLIENTE_CONFIDENCIAL",
  "sk-clave-sintetica",
  "prompt privado",
] as const;

/** Error crudo tal y como lo entregaría un SDK: con eco del cuerpo y del prompt. */
function errorCrudoDelProveedor(): Error {
  return Object.assign(
    new Error(
      `400 RAW_PROVIDER_BODY {"messages":[{"content":"prompt privado de CLIENTE_CONFIDENCIAL"}],` +
        `"apiKey":"sk-clave-sintetica"}`
    ),
    { status: 400 }
  );
}

function noContieneMarcadores(texto: string) {
  for (const marcador of MARCADORES) {
    expect(texto).not.toContain(marcador);
  }
}

// ── Doble de base de datos ───────────────────────────────────────────────────

const { dbMock, registro } = vi.hoisted(() => {
  /** Toda escritura que la superficie intente persistir, en orden. */
  const registro: Array<{ op: "set" | "values"; payload: unknown }> = [];

  /**
   * Fila genérica: satisface a la vez `[job]`, `[account]`, `[claimed]` y
   * `[brandRow]`. Evita una cola de resultados por invocación, que obligaría a
   * contar llamadas y se rompería con cualquier reordenación interna.
   */
  const FILA = {
    id: "11111111-1111-1111-1111-111111111111",
    balance: 99999,
    ownerId: "owner-1",
    name: "Marca",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  function cadena(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    const resolver = () => Promise.resolve([FILA]);
    obj.set = (payload: unknown) => {
      registro.push({ op: "set", payload });
      return obj;
    };
    obj.values = (payload: unknown) => {
      registro.push({ op: "values", payload });
      return obj;
    };
    obj.where = () => obj;
    obj.from = () => obj;
    obj.limit = () => resolver();
    obj.returning = () => resolver();
    obj.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      resolver().then(res, rej);
    obj.catch = (rej: (e: unknown) => unknown) => resolver().catch(rej);
    return obj;
  }

  const dbMock = {
    insert: () => cadena(),
    update: () => cadena(),
    select: () => cadena(),
    transaction: async (fn: (tx: unknown) => unknown) => fn(dbMock),
  };

  return { dbMock, registro };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { getSessionUidMock, resolveOwnerIdMock, resolveBrandRowMock, resolveCampaignRowMock } =
  vi.hoisted(() => ({
    getSessionUidMock: vi.fn(),
    resolveOwnerIdMock: vi.fn(),
    resolveBrandRowMock: vi.fn(),
    resolveCampaignRowMock: vi.fn(),
  }));

vi.mock("@/lib/auth/session", () => ({ getSessionUserId: getSessionUidMock }));

vi.mock("@/lib/growth/pg", () => ({
  resolveOwnerId: resolveOwnerIdMock,
  resolveBrandRow: resolveBrandRowMock,
  resolveCampaignRow: resolveCampaignRowMock,
  publicId: (row: { id: string }) => row.id,
}));

const { getBrandMock, runPostGenerationMock, generateTextMock } = vi.hoisted(() => ({
  getBrandMock: vi.fn(),
  runPostGenerationMock: vi.fn(),
  generateTextMock: vi.fn(),
}));

vi.mock("@/lib/growth/actions/brands", () => ({ getBrand: getBrandMock }));
vi.mock("@/lib/growth/ai/orchestrator", () => ({ runPostGeneration: runPostGenerationMock }));
vi.mock("@/lib/growth/ai/providers/openai-text", () => ({ generateText: generateTextMock }));

// El prompt de negocio no es lo que se prueba aquí; construirlo exigiría un
// BrandBrain completo y no cambia lo que cruza al fallar.
vi.mock("@/lib/growth/ai/prompt-builder", () => ({
  buildSystemPrompt: () => "system sintetico",
  buildUserPrompt: () => "user sintetico",
  buildImagePrompt: () => "image sintetico",
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { POST as postGeneratePost } from "@/app/api/growth/generate-post/route";
import { generateCampaignStrategy } from "@/lib/growth/actions/campaigns";
import { AiProviderError, SafeUserError } from "./errors";
import { EgressBlockedError } from "@/lib/egress-guard";

const FILA_MARCA = {
  id: "22222222-2222-2222-2222-222222222222",
  ownerId: "owner-1",
  name: "Marca",
  identity: {},
  voice: {},
  business: {},
  positioning: {},
  objections: [],
  contentRules: {},
};

const FILA_CAMPANA = {
  id: "33333333-3333-3333-3333-333333333333",
  ownerId: "owner-1",
  brandId: FILA_MARCA.id,
  name: "Campaña",
  objective: "vender",
  targetAction: "comprar",
  targetPlatforms: ["instagram"],
  status: "planning",
};

beforeEach(() => {
  vi.clearAllMocks();
  registro.length = 0;
  getSessionUidMock.mockResolvedValue("uid-1");
  resolveOwnerIdMock.mockResolvedValue("owner-1");
  resolveBrandRowMock.mockResolvedValue(FILA_MARCA);
  resolveCampaignRowMock.mockResolvedValue(FILA_CAMPANA);
  getBrandMock.mockResolvedValue({ id: FILA_MARCA.id, name: "Marca" });
});

function peticionGenerarPost(): NextRequest {
  return new NextRequest("http://localhost/api/growth/generate-post", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      brandId: FILA_MARCA.id,
      request: { objective: "vender", format: "instagram_post" },
    }),
  });
}

/** Lo que la superficie intentó escribir en `growth_jobs.error`. */
function erroresPersistidos(): unknown[] {
  return registro
    .filter((entrada) => {
      const payload = entrada.payload as { error?: unknown } | null;
      return typeof payload === "object" && payload !== null && "error" in payload;
    })
    .map((entrada) => (entrada.payload as { error: unknown }).error);
}

// ── 1. API route real ────────────────────────────────────────────────────────

describe("POST /api/growth/generate-post — el error crudo no sale", () => {
  it("persiste un código estable y responde 500 sin marcadores", async () => {
    runPostGenerationMock.mockRejectedValue(errorCrudoDelProveedor());

    const res = await postGeneratePost(peticionGenerarPost());
    const cuerpo = (await res.json()) as { error?: string; code?: string };

    expect(res.status).toBe(500);

    // Lo persistido en growth_jobs.error es exactamente un código.
    const persistidos = erroresPersistidos();
    expect(persistidos).toHaveLength(1);
    expect(persistidos[0]).toBe("internal_error");

    // Ni la fila ni la respuesta contienen nada del proveedor.
    noContieneMarcadores(JSON.stringify(registro));
    noContieneMarcadores(JSON.stringify(cuerpo));

    expect(cuerpo.error).toBe("No se pudo generar el post.");
    expect(cuerpo.code).toBe("internal_error");
  });

  it("un AiProviderError persiste su código y conserva el mensaje seguro", async () => {
    runPostGenerationMock.mockRejectedValue(
      new AiProviderError({
        provider: "openai",
        operation: "generate_text",
        code: "ai_provider_error",
        status: 429,
      })
    );

    const res = await postGeneratePost(peticionGenerarPost());
    const cuerpo = (await res.json()) as { error?: string; code?: string };

    expect(erroresPersistidos()).toEqual(["ai_provider_error"]);
    expect(cuerpo.code).toBe("ai_provider_error");
    expect(cuerpo.error).toBe("No se pudo generar el post.");
    noContieneMarcadores(JSON.stringify(cuerpo));
  });

  it("un bloqueo de política se persiste como ai_egress_blocked", async () => {
    runPostGenerationMock.mockRejectedValue(
      new EgressBlockedError({ channel: "ai", operation: "generate_text", reason: "mode_disabled" })
    );

    const res = await postGeneratePost(peticionGenerarPost());
    const cuerpo = (await res.json()) as { error?: string; code?: string };

    expect(erroresPersistidos()).toEqual(["ai_egress_blocked"]);
    // La razón de política tampoco viaja al cliente: describe la configuración.
    expect(JSON.stringify(cuerpo)).not.toContain("mode_disabled");
  });

  it("un SafeUserError conserva su mensaje: lo redactamos nosotros", async () => {
    runPostGenerationMock.mockRejectedValue(
      new SafeUserError("Créditos insuficientes. Necesitas 6, tienes 2.", "insufficient_credits")
    );

    const res = await postGeneratePost(peticionGenerarPost());
    const cuerpo = (await res.json()) as { error?: string; code?: string };

    expect(erroresPersistidos()).toEqual(["insufficient_credits"]);
    expect(cuerpo.error).toBe("Créditos insuficientes. Necesitas 6, tienes 2.");
  });
});

// ── 2. Server action real ────────────────────────────────────────────────────

describe("generateCampaignStrategy — el error crudo no vuelve al cliente", () => {
  it("devuelve el mensaje seguro y ningún marcador", async () => {
    generateTextMock.mockRejectedValue(errorCrudoDelProveedor());

    const resultado = await generateCampaignStrategy(FILA_CAMPANA.id);

    expect(resultado.ok).toBe(false);
    expect(resultado.error).toBe("Error interno generando la estrategia");
    noContieneMarcadores(JSON.stringify(resultado));
    // Tampoco quedó escrito en ninguna fila durante ese camino.
    noContieneMarcadores(JSON.stringify(registro));
  });

  it("un AiProviderError tampoco aporta texto de terceros", async () => {
    generateTextMock.mockRejectedValue(
      new AiProviderError({
        provider: "openai",
        operation: "generate_text",
        code: "ai_provider_error",
        status: 500,
      })
    );

    const resultado = await generateCampaignStrategy(FILA_CAMPANA.id);

    expect(resultado.ok).toBe(false);
    expect(resultado.error).toBe("Error interno generando la estrategia");
  });

  it("un bloqueo de política no revela la razón de configuración", async () => {
    generateTextMock.mockRejectedValue(
      new EgressBlockedError({
        channel: "ai",
        operation: "generate_text",
        reason: "target_not_allowed",
      })
    );

    const resultado = await generateCampaignStrategy(FILA_CAMPANA.id);

    expect(resultado.ok).toBe(false);
    expect(JSON.stringify(resultado)).not.toContain("target_not_allowed");
  });

  it("el fallo de parseo propio conserva su mensaje", async () => {
    // Respuesta que no es JSON: dispara el `SafeUserError` de parseo.
    generateTextMock.mockResolvedValue({
      text: "no soy json",
      tokensUsed: { input: 1, output: 1 },
      cost: 0,
      generationMs: 1,
      model: "gpt-4o",
    });

    const resultado = await generateCampaignStrategy(FILA_CAMPANA.id);

    expect(resultado.ok).toBe(false);
    expect(resultado.error).toBe("Error al parsear la estrategia de IA");
  });
});
