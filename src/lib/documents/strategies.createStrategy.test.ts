import { describe, expect, test, vi, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * `createStrategy` — regresión de la revisión de PR #98:
 * 1. La invariancia "a lo sumo una estrategia por owner/cliente/proyecto (o
 *    huérfana)" vive en DB (drizzle/0038), no solo en un SELECT→INSERT del
 *    repo — insertar concurrente reutiliza la fila existente, no duplica.
 * 2. `resolveOwnedProjectForClientPgId` (no `resolveOwnedProjectPgId`): un
 *    proyecto de OTRO cliente del mismo owner se rechaza como no encontrado.
 */

const OWNER_ID = "owner-1";
const CLIENT_PG_ID = "client-pg-1";
const PROJECT_PG_ID = "project-pg-1";
const NEW_ID = "strategy-new-1";
const EXISTING_ID = "strategy-existing-1";

function uniqueViolation(constraint: string) {
  // El .d.ts de `postgres` solo declara el constructor heredado de Error
  // (string), aunque en runtime acepta un objeto (Object.assign interno) —
  // se construye así para que tipe limpio sin desviarse del comportamiento real.
  const pgError = Object.assign(
    new postgres.PostgresError("duplicate key value violates unique constraint"),
    { code: "23505", constraint_name: constraint },
  );
  // Drizzle envuelve el PostgresError original en un DrizzleQueryError propio
  // y lo expone en `.cause` — mismo criterio que pixelforge.ts.
  return new Error("Failed query", { cause: pgError });
}

const mocks = vi.hoisted(() => {
  const insertReturning = vi.fn();
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));

  const selectLimit = vi.fn();
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const db = { insert, select };

  return {
    requireOwner: vi.fn(),
    resolveOwnedClientPgId: vi.fn(),
    resolveOwnedProjectForClientPgId: vi.fn(),
    db,
    insert,
    insertValues,
    insertReturning,
    select,
    selectFrom,
    selectWhere,
    selectLimit,
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./pg", () => ({
  requireOwner: mocks.requireOwner,
  resolveOwnedClientPgId: mocks.resolveOwnedClientPgId,
  resolveOwnedProjectForClientPgId: mocks.resolveOwnedProjectForClientPgId,
  resolveClientPgId: vi.fn(),
  resolveProjectPgId: vi.fn(),
  resolveStrategyRow: vi.fn(),
  serializeStrategy: vi.fn(),
}));

const { createStrategy } = await import("./strategies");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOwner.mockResolvedValue({ uid: "u1", ownerId: OWNER_ID });
  mocks.resolveOwnedClientPgId.mockResolvedValue(CLIENT_PG_ID);
  mocks.resolveOwnedProjectForClientPgId.mockResolvedValue(PROJECT_PG_ID);
});

describe("createStrategy — invariancia en DB (drizzle/0038)", () => {
  test("caso feliz: inserta y devuelve el id nuevo", async () => {
    mocks.insertReturning.mockResolvedValue([{ id: NEW_ID }]);

    const id = await createStrategy("u1", "client-pub", "project-pub");

    expect(id).toBe(NEW_ID);
    expect(mocks.selectLimit).not.toHaveBeenCalled();
  });

  test("inserción concurrente (23505 en el índice con proyecto): reutiliza la fila existente, no duplica", async () => {
    mocks.insertReturning.mockRejectedValue(uniqueViolation("strategies_owner_client_project_uidx"));
    mocks.selectLimit.mockResolvedValue([{ id: EXISTING_ID }]);

    const id = await createStrategy("u1", "client-pub", "project-pub");

    expect(id).toBe(EXISTING_ID);
  });

  test("inserción concurrente (23505 en el índice huérfano, sin projectId): reutiliza la fila existente", async () => {
    mocks.resolveOwnedProjectForClientPgId.mockResolvedValue(null);
    mocks.insertReturning.mockRejectedValue(uniqueViolation("strategies_owner_client_orphan_uidx"));
    mocks.selectLimit.mockResolvedValue([{ id: EXISTING_ID }]);

    const id = await createStrategy("u1", "client-pub");

    expect(id).toBe(EXISTING_ID);
  });

  test("un error de DB que NO es la violación de estas dos constraints se relanza sin ocultar", async () => {
    mocks.insertReturning.mockRejectedValue(new Error("conexión perdida"));

    await expect(createStrategy("u1", "client-pub", "project-pub")).rejects.toThrow("conexión perdida");
  });
});

describe("createStrategy — proyecto debe ser del mismo cliente (item 3)", () => {
  test("projectId de OTRO cliente del mismo owner: responde como no encontrado, no enlaza mal", async () => {
    mocks.resolveOwnedProjectForClientPgId.mockResolvedValue(null);

    await expect(createStrategy("u1", "client-pub", "project-de-otro-cliente")).rejects.toThrow(
      "Proyecto no encontrado",
    );
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  test("resuelve el proyecto pasando el clientPgId ya verificado, no solo el ownerId", async () => {
    mocks.insertReturning.mockResolvedValue([{ id: NEW_ID }]);

    await createStrategy("u1", "client-pub", "project-pub");

    expect(mocks.resolveOwnedProjectForClientPgId).toHaveBeenCalledWith(
      "project-pub",
      CLIENT_PG_ID,
      OWNER_ID,
    );
  });
});
