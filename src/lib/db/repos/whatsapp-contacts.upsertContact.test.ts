import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * `upsertContact` — regresión de la revisión de PR #98 (item 4): el
 * `SELECT ... FOR UPDATE` no protege la creación inicial (no hay fila que
 * lockear si el phone es nuevo). Se garantiza una fila mínima primero
 * (INSERT ... ON CONFLICT DO NOTHING), luego el lock, luego el merge.
 */

const PHONE = "+5210000000000";

const mocks = vi.hoisted(() => {
  let insertCallCount = 0;

  const ensureRowConflictDoNothing = vi.fn(async () => undefined);
  const ensureRowValues = vi.fn(() => ({ onConflictDoNothing: ensureRowConflictDoNothing }));

  const upsertReturning = vi.fn();
  const upsertConflictDoUpdate = vi.fn(() => ({ returning: upsertReturning }));
  const upsertValues = vi.fn(() => ({ onConflictDoUpdate: upsertConflictDoUpdate }));

  const insert = vi.fn(() => {
    insertCallCount += 1;
    if (insertCallCount % 2 === 1) return { values: ensureRowValues };
    return { values: upsertValues };
  });

  const selectFor = vi.fn();
  const selectWhere = vi.fn(() => ({ for: selectFor }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const tx = { insert, select };
  const db = { transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) };

  return {
    db,
    insert,
    ensureRowConflictDoNothing,
    upsertConflictDoUpdate,
    upsertValues,
    upsertReturning,
    selectFor,
    selectWhere,
    resetInsertCounter: () => {
      insertCallCount = 0;
    },
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));

const { upsertContact } = await import("./whatsapp-contacts");

function rowFor(actionHistory: Array<{ at: string; byUid: string; action: string }>) {
  return {
    phone: PHONE,
    name: null,
    classification: null,
    tags: [],
    assignedTo: null,
    origin: null,
    status: null,
    urgent: false,
    linkedClientId: null,
    actionHistory,
    createdAt: new Date("2026-08-06T00:00:00Z"),
    updatedAt: new Date("2026-08-06T00:00:00Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resetInsertCounter();
});

describe("upsertContact — fila mínima antes del lock", () => {
  test("garantiza la fila (ON CONFLICT DO NOTHING) ANTES de SELECT ... FOR UPDATE", async () => {
    mocks.selectFor.mockResolvedValue([]);
    mocks.upsertReturning.mockResolvedValue([rowFor([])]);

    await upsertContact(PHONE, {}, "user-1");

    expect(mocks.ensureRowConflictDoNothing).toHaveBeenCalledWith({ target: expect.anything() });
    expect(mocks.selectFor).toHaveBeenCalledWith("update");
    const ensureOrder = mocks.ensureRowConflictDoNothing.mock.invocationCallOrder[0];
    const lockOrder = mocks.selectFor.mock.invocationCallOrder[0];
    expect(ensureOrder).toBeLessThan(lockOrder);
  });

  test("dos primeros upserts concurrentes del mismo phone nuevo: ambas acciones sobreviven (serializado por el lock)", async () => {
    // Upsert #1: nadie existía todavía (la fila mínima se acaba de crear).
    mocks.selectFor.mockResolvedValueOnce([rowFor([])]);
    mocks.upsertReturning.mockResolvedValueOnce([
      rowFor([{ at: "2026-08-06T00:00:01Z", byUid: "user-1", action: "clasificado" }]),
    ]);
    const first = await upsertContact(PHONE, { classification: "prospecto" }, "user-1", "clasificado");
    expect(first.actionHistory).toHaveLength(1);

    // Upsert #2: con el lock, ve la fila que el #1 YA commiteó — su
    // actionHistory de partida incluye la acción del #1.
    mocks.selectFor.mockResolvedValueOnce([
      rowFor([{ at: "2026-08-06T00:00:01Z", byUid: "user-1", action: "clasificado" }]),
    ]);
    mocks.upsertReturning.mockResolvedValueOnce([
      rowFor([
        { at: "2026-08-06T00:00:01Z", byUid: "user-1", action: "clasificado" },
        { at: "2026-08-06T00:00:02Z", byUid: "user-2", action: "asignado" },
      ]),
    ]);
    const second = await upsertContact(PHONE, { assignedTo: "user-2" }, "user-2", "asignado");

    expect(second.actionHistory).toHaveLength(2);
    expect(second.actionHistory?.map((a) => a.action)).toEqual(["clasificado", "asignado"]);
  });
});
