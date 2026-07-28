import { describe, expect, test, vi, beforeEach } from "vitest";
import { SafeUserError } from "@/lib/ai/errors";

/**
 * Saneamiento de errores en las Server Actions de Definición — los 4 puntos de
 * G-04 de este archivo (E0f-3a).
 *
 * `DraftEditor` y `DefinitionWorkspace` pintan el campo `error` directamente,
 * así que su contenido es tan público como una respuesta HTTP.
 */

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

const repo = vi.hoisted(() => ({
  createDefinition: vi.fn(),
  startDefinition: vi.fn(),
  updateDraft: vi.fn(),
  getDefinition: vi.fn(),
  getDefinitionFull: vi.fn(),
  sealStation: vi.fn(),
  reopenStation: vi.fn(),
  attachProposal: vi.fn(),
  listDefinitionsByClient: vi.fn(),
}));

vi.mock("@/lib/auth/config", () => ({ auth: authMock }));
vi.mock("@/lib/db/repos/definitions", () => repo);
vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/lib/db/schema", () => ({ clients: {} }));
vi.mock("@/lib/documents/proposals", () => ({ createProposal: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  startDefinitionAction,
  updateDraftAction,
  approveStationAction,
  reopenStationAction,
} from "./actions";

const UUID = "22222222-2222-4222-8222-222222222222";

const RAW_SQL = "SELECT * FROM definitions WHERE owner_id = $1";
const CLIENTE_CONFIDENCIAL = "Clínica Smile More — +5213221234567";
const ENV_SECRET_NAME = "DATABASE_URL";
const STACK_INTERNO = "at Object.<anonymous> (/Users/pixeltec/pixeltec-os/src/lib/db/index.ts:42:11)";

const MARCADORES = [RAW_SQL, CLIENTE_CONFIDENCIAL, ENV_SECRET_NAME, STACK_INTERNO];

const MESSAGE_ENVENENADO = [
  STACK_INTERNO,
  RAW_SQL,
  `env ${ENV_SECRET_NAME} is not set`,
  CLIENTE_CONFIDENCIAL,
].join(" | ");

type ActionResult = { success: boolean; error?: string };

function sinFugas(result: unknown) {
  const salida = JSON.stringify(result);
  for (const marcador of MARCADORES) {
    expect(salida).not.toContain(marcador);
  }
}

const ACCIONES: Array<{ punto: string; run: () => Promise<unknown>; fallback: string }> = [
  {
    punto: "startDefinitionAction",
    fallback: "No se pudo iniciar la definición",
    run: () => startDefinitionAction({ definitionId: UUID }),
  },
  {
    punto: "updateDraftAction",
    fallback: "No se pudo guardar el borrador",
    run: () =>
      updateDraftAction({
        definitionId: UUID,
        title: "Título",
        brainDump: "Contenido suficientemente largo para el schema.",
      }),
  },
  {
    punto: "approveStationAction",
    fallback: "No se pudo aprobar la estación",
    run: () => approveStationAction({ definitionId: UUID, station: "contexto" as never }),
  },
  {
    punto: "reopenStationAction",
    fallback: "No se pudo reabrir la estación",
    run: () =>
      reopenStationAction({
        definitionId: UUID,
        station: "contexto" as never,
        reason: "motivo suficiente",
      }),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  authMock.mockResolvedValue({ user: { id: "user-1", name: "Miguel" } });
});

describe("Server Actions de Definición — el error desconocido no llega al workspace", () => {
  test.each(ACCIONES)("$punto devuelve el fallback sin filtrar nada", async ({ run, fallback }) => {
    authMock.mockRejectedValueOnce(new Error(MESSAGE_ENVENENADO));

    const result = (await run()) as ActionResult;

    expect(result.success).toBe(false);
    expect(result.error).toBe(fallback);
    sinFugas(result);
  });

  test.each(ACCIONES)("$punto no filtra un error de Drizzle", async ({ run, fallback }) => {
    authMock.mockRejectedValueOnce(
      Object.assign(new Error(`relation "definitions" does not exist`), {
        name: "PostgresError",
        code: "42P01",
        query: RAW_SQL,
        stack: STACK_INTERNO,
      })
    );

    const result = (await run()) as ActionResult;

    expect(result.success).toBe(false);
    expect(result.error).toBe(fallback);
    sinFugas(result);
  });

  test.each(ACCIONES)("$punto no propaga un objeto plano lanzado", async ({ run, fallback }) => {
    authMock.mockRejectedValueOnce({ message: MESSAGE_ENVENENADO, code: 500 });

    const result = (await run()) as ActionResult;

    expect(result.error).toBe(fallback);
    sinFugas(result);
  });
});

describe("Server Actions de Definición — lo nuestro sí pasa", () => {
  test("un SafeUserError conserva su mensaje", async () => {
    authMock.mockRejectedValueOnce(new SafeUserError("Definición no encontrada", "not_found"));

    const result = (await startDefinitionAction({ definitionId: UUID })) as ActionResult;

    expect(result.error).toBe("Definición no encontrada");
  });

  test("el camino de éxito no cambia", async () => {
    repo.startDefinition.mockResolvedValue(undefined);

    const result = await startDefinitionAction({ definitionId: UUID });

    expect(result).toEqual({ success: true });
  });
});
