import { describe, expect, test, vi, beforeEach } from "vitest";
import { SafeUserError } from "@/lib/ai/errors";

/**
 * Saneamiento de errores en la Server Action de sincronización del CRM — el
 * punto de G-04 de este archivo (E0f-3a).
 *
 * Era el único de los 22 que combinaba `error.message` **y** `String(error)`:
 * lo segundo arrastra objetos enteros, no sólo un texto. `CRMContextCore`
 * consume el campo directamente.
 */

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

const repo = vi.hoisted(() => ({
  getFullCrmData: vi.fn(),
  syncCrmClients: vi.fn(),
  syncCrmTools: vi.fn(),
  syncCrmStreak: vi.fn(),
  syncCrmServerLinks: vi.fn(),
  syncCrmSessions: vi.fn(),
}));

vi.mock("@/lib/auth/config", () => ({ auth: authMock }));
vi.mock("@/lib/db/repos/crm-sync", () => repo);

import { syncCrmDataAction } from "./crm-actions";

const RAW_SQL = "SELECT * FROM crm_clients WHERE owner_id = $1";
const CLIENTE_CONFIDENCIAL = "Clínica Smile More — +5213221234567";
const STACK_INTERNO = "at Object.<anonymous> (/Users/pixeltec/pixeltec-os/src/lib/db/index.ts:42:11)";
const MARCADORES = [RAW_SQL, CLIENTE_CONFIDENCIAL, STACK_INTERNO];

const MESSAGE_ENVENENADO = [RAW_SQL, CLIENTE_CONFIDENCIAL, STACK_INTERNO].join(" | ");

const FALLBACK = "No se pudo sincronizar la información del CRM.";

type Result = { ok: boolean; error?: string };

function sinFugas(result: unknown) {
  const salida = JSON.stringify(result);
  for (const marcador of MARCADORES) {
    expect(salida).not.toContain(marcador);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  authMock.mockResolvedValue({ user: { id: "user-1" } });
  repo.syncCrmStreak.mockResolvedValue(undefined);
});

describe("syncCrmDataAction — ni el message ni el objeto llegan a CRMContextCore", () => {
  test("un fallo de Drizzle devuelve el fallback propio", async () => {
    repo.syncCrmStreak.mockRejectedValueOnce(
      Object.assign(new Error(`relation "crm_clients" does not exist`), {
        name: "PostgresError",
        code: "42P01",
        query: RAW_SQL,
        detail: CLIENTE_CONFIDENCIAL,
        stack: STACK_INTERNO,
      })
    );

    const result = (await syncCrmDataAction({ streak: 3 } as never)) as Result;

    expect(result.ok).toBe(false);
    expect(result.error).toBe(FALLBACK);
    sinFugas(result);
  });

  test("un objeto lanzado que no es Error tampoco se serializa", async () => {
    // Éste es el caso que `String(error)` convertía en "[object Object]" en el
    // mejor de los casos, y en el objeto entero en el peor.
    repo.syncCrmStreak.mockRejectedValueOnce({
      message: MESSAGE_ENVENENADO,
      clientes: [CLIENTE_CONFIDENCIAL],
    });

    const result = (await syncCrmDataAction({ streak: 3 } as never)) as Result;

    expect(result.error).toBe(FALLBACK);
    sinFugas(result);
  });

  test("un string lanzado no se propaga", async () => {
    repo.syncCrmStreak.mockRejectedValueOnce(MESSAGE_ENVENENADO);

    const result = (await syncCrmDataAction({ streak: 3 } as never)) as Result;

    expect(result.error).toBe(FALLBACK);
    sinFugas(result);
  });

  test("un SafeUserError conserva su mensaje", async () => {
    repo.syncCrmStreak.mockRejectedValueOnce(
      new SafeUserError("Sesión expirada", "session_expired")
    );

    const result = (await syncCrmDataAction({ streak: 3 } as never)) as Result;

    expect(result.error).toBe("Sesión expirada");
  });

  test("el contrato de éxito no cambia", async () => {
    const result = await syncCrmDataAction({ streak: 3 } as never);

    expect(result).toEqual({ ok: true });
  });
});
