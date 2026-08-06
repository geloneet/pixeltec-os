import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * `createDiscoverySession`/`assignDiscoveryToProject` — regresión de la
 * revisión de PR #98 (item 3): el proyecto debe pertenecer al MISMO cliente,
 * no solo al mismo owner. Antes resolvían clientId y projectId por separado
 * con `resolveOwnedProjectPgId`, así que un proyecto de OTRO cliente del
 * mismo owner pasaba y enlazaba mal los datos.
 */

const OWNER_ID = "owner-1";
const CLIENT_PG_ID = "client-pg-1";
const SESSION_ID = "session-1";

const mocks = vi.hoisted(() => {
  const insertReturning = vi.fn(async () => [{ id: "session-new-1" }]);
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));

  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const db = { insert, update };

  return {
    requireOwner: vi.fn(),
    resolveOwnedClientPgId: vi.fn(),
    resolveOwnedProjectForClientPgId: vi.fn(),
    resolveDiscoveryRow: vi.fn(),
    db,
    insert,
    insertValues,
    update,
    updateSet,
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./pg", () => ({
  requireOwner: mocks.requireOwner,
  resolveOwnedClientPgId: mocks.resolveOwnedClientPgId,
  resolveOwnedProjectForClientPgId: mocks.resolveOwnedProjectForClientPgId,
  resolveClientPgId: vi.fn(),
  resolveProjectPgId: vi.fn(),
  resolveDiscoveryRow: mocks.resolveDiscoveryRow,
  serializeDiscovery: vi.fn(),
}));

const { createDiscoverySession, assignDiscoveryToProject } = await import("./discovery");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOwner.mockResolvedValue({ uid: "u1", ownerId: OWNER_ID });
  mocks.resolveOwnedClientPgId.mockResolvedValue(CLIENT_PG_ID);
});

describe("createDiscoverySession — proyecto debe ser del mismo cliente", () => {
  test("projectId de OTRO cliente del mismo owner: responde como no encontrado", async () => {
    mocks.resolveOwnedProjectForClientPgId.mockResolvedValue(null);

    await expect(
      createDiscoverySession(
        "u1",
        "client-pub",
        { industry: "tech", status: "generando", questions: [], answers: {}, generatedAt: new Date().toISOString() },
        "project-de-otro-cliente",
      ),
    ).rejects.toThrow("Proyecto no encontrado");
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  test("resuelve el proyecto pasando el clientPgId ya verificado, no solo el ownerId", async () => {
    mocks.resolveOwnedProjectForClientPgId.mockResolvedValue("project-pg-1");

    await createDiscoverySession(
      "u1",
      "client-pub",
      { industry: "tech", status: "generando", questions: [], answers: {}, generatedAt: new Date().toISOString() },
      "project-pub",
    );

    expect(mocks.resolveOwnedProjectForClientPgId).toHaveBeenCalledWith("project-pub", CLIENT_PG_ID, OWNER_ID);
  });
});

describe("assignDiscoveryToProject — proyecto debe ser del mismo cliente que la sesión", () => {
  test("projectId de OTRO cliente: responde como no encontrado, no reasigna", async () => {
    mocks.resolveDiscoveryRow.mockResolvedValue({ id: SESSION_ID, ownerId: OWNER_ID, clientId: CLIENT_PG_ID });
    mocks.resolveOwnedProjectForClientPgId.mockResolvedValue(null);

    await expect(assignDiscoveryToProject(SESSION_ID, "project-de-otro-cliente")).rejects.toThrow(
      "Proyecto no encontrado",
    );
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  test("proyecto del mismo cliente: reasigna correctamente", async () => {
    mocks.resolveDiscoveryRow.mockResolvedValue({ id: SESSION_ID, ownerId: OWNER_ID, clientId: CLIENT_PG_ID });
    mocks.resolveOwnedProjectForClientPgId.mockResolvedValue("project-pg-1");

    await assignDiscoveryToProject(SESSION_ID, "project-pub");

    expect(mocks.resolveOwnedProjectForClientPgId).toHaveBeenCalledWith("project-pub", CLIENT_PG_ID, OWNER_ID);
    expect(mocks.updateSet).toHaveBeenCalledWith({ projectId: "project-pg-1" });
  });
});
