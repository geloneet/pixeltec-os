import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Gate E0c-2 — propagación en el orquestador de Growth.
 *
 * Vive aparte de `./growth-propagation.test.ts` porque aquí `runPostGeneration`
 * se ejecuta **real**: es la función que captura el fallo de generación de
 * imagen y decide qué se registra. Antes de este gate imprimía el objeto de
 * error completo del proveedor, que puede citar el prompt de imagen y el cuerpo
 * de la respuesta.
 */

const MARCADORES = [
  "RAW_PROVIDER_BODY",
  "CLIENTE_CONFIDENCIAL",
  "sk-clave-sintetica",
  "prompt privado",
] as const;

/** Error cargado: mensaje sensible, body, request, prompt y key sintética. */
function errorCrudoDeImagen(): Error {
  return Object.assign(
    new Error("RAW_PROVIDER_BODY: prompt privado rechazado para CLIENTE_CONFIDENCIAL"),
    {
      status: 400,
      body: { error: "RAW_PROVIDER_BODY", prompt: "prompt privado" },
      request: { headers: { authorization: "Bearer sk-clave-sintetica" } },
      prompt: "prompt privado de CLIENTE_CONFIDENCIAL",
      key: "sk-clave-sintetica",
    }
  );
}

const { dbMock } = vi.hoisted(() => {
  const FILA = {
    id: "11111111-1111-1111-1111-111111111111",
    balance: 99999,
    ownerId: "owner-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  function cadena(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    const resolver = () => Promise.resolve([FILA]);
    obj.set = () => obj;
    obj.values = () => obj;
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

  return { dbMock };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { resolveOwnerIdMock, resolveBrandRowMock, generateTextMock, generateFluxImageMock } =
  vi.hoisted(() => ({
    resolveOwnerIdMock: vi.fn(),
    resolveBrandRowMock: vi.fn(),
    generateTextMock: vi.fn(),
    generateFluxImageMock: vi.fn(),
  }));

vi.mock("@/lib/growth/pg", () => ({
  resolveOwnerId: resolveOwnerIdMock,
  resolveBrandRow: resolveBrandRowMock,
  publicId: (row: { id: string }) => row.id,
}));

vi.mock("@/lib/growth/ai/providers/openai-text", () => ({ generateText: generateTextMock }));
vi.mock("@/lib/growth/ai/providers/flux-image", () => ({
  generateFluxImage: generateFluxImageMock,
}));

vi.mock("@/lib/growth/ai/prompt-builder", () => ({
  buildSystemPrompt: () => "system sintetico",
  buildUserPrompt: () => "user sintetico",
  buildImagePrompt: () => "image sintetico",
}));

import { runPostGeneration } from "@/lib/growth/ai/orchestrator";
import { AiProviderError } from "./errors";
import { EgressBlockedError } from "@/lib/egress-guard";
import type { BrandBrain } from "@/types/growth/brand-brain";

const MARCA = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Marca",
  business: { industry: "software" },
  voice: { personality: ["directa", "clara", "cercana"] },
  identity: { colors: { primary: "#000000" }, logoUrl: "https://ejemplo/logo.png" },
} as unknown as BrandBrain;

/** Respuesta de texto válida que además pide imagen: activa la rama de Flux. */
const TEXTO_CON_IMAGEN = {
  text: JSON.stringify({
    caption: "un caption",
    hashtags: ["#a"],
    imagePrompt: "una imagen",
    altText: "alt",
    suggestedTime: "10:00",
  }),
  tokensUsed: { input: 10, output: 5 },
  cost: 0.001,
  generationMs: 12,
  model: "gpt-4o",
};

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  resolveOwnerIdMock.mockResolvedValue("owner-1");
  resolveBrandRowMock.mockResolvedValue({ id: "fila-marca", ownerId: "owner-1" });
  generateTextMock.mockResolvedValue(TEXTO_CON_IMAGEN);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

async function ejecutar() {
  return runPostGeneration({
    uid: "uid-1",
    brand: MARCA,
    request: {
      objective: "vender",
      format: "instagram_post",
      withImage: true,
    } as unknown as Parameters<typeof runPostGeneration>[0]["request"],
    jobId: "job-1",
  });
}

/** Todo lo que llegó a `console.error`, serializado como lo vería un log. */
function argumentosRegistrados(): string {
  return (errorSpy.mock.calls as unknown[][])
    .map((llamada: unknown[]) =>
      llamada
        .map((arg: unknown) =>
          typeof arg === "string"
            ? arg
            : JSON.stringify(arg, Object.getOwnPropertyNames(Object(arg)))
        )
        .join(" ")
    )
    .join("\n");
}

describe("runPostGeneration — el fallo de imagen no llega crudo a los logs", () => {
  it("no pasa el objeto del proveedor y no registra ningún marcador", async () => {
    generateFluxImageMock.mockRejectedValue(errorCrudoDeImagen());

    const post = await ejecutar();

    // El post se entrega igualmente, solo texto: la política de negocio no cambia.
    expect(post.imageUrl).toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);

    // Un único argumento, y es una cadena: el objeto no viaja.
    const llamada = errorSpy.mock.calls[0];
    expect(llamada).toHaveLength(1);
    expect(typeof llamada[0]).toBe("string");

    const registrado = argumentosRegistrados();
    for (const marcador of MARCADORES) {
      expect(registrado).not.toContain(marcador);
    }

    // Solo información permitida: código y, si lo hubo, status.
    expect(registrado).toContain("internal_error");
    expect(registrado).toContain("continuing text-only");
  });

  it("un AiProviderError registra código, y status cuando existe", async () => {
    generateFluxImageMock.mockRejectedValue(
      new AiProviderError({
        provider: "fal",
        operation: "generate_image",
        code: "ai_provider_error",
        status: 503,
      })
    );

    await ejecutar();

    const registrado = argumentosRegistrados();
    expect(registrado).toContain("ai_provider_error");
    expect(registrado).toContain("status 503");
    for (const marcador of MARCADORES) {
      expect(registrado).not.toContain(marcador);
    }
  });

  it("un bloqueo de política se registra como ai_egress_blocked sin la razón", async () => {
    generateFluxImageMock.mockRejectedValue(
      new EgressBlockedError({
        channel: "ai",
        operation: "generate_image",
        reason: "target_not_allowed",
      })
    );

    await ejecutar();

    const registrado = argumentosRegistrados();
    expect(registrado).toContain("ai_egress_blocked");
    expect(registrado).not.toContain("target_not_allowed");
  });

  it("el error de texto sí se propaga al llamador, y sin marcadores", async () => {
    // El fallo de texto no se captura aquí: sube a la ruta, que ya lo sanea.
    generateTextMock.mockRejectedValue(errorCrudoDeImagen());

    await expect(ejecutar()).rejects.toThrow();
    // Y no se registró nada por el camino.
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
