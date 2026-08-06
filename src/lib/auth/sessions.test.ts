import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `user_sessions` (C-PR3): mint fire-safe, validación FAIL-OPEN ante errores
 * de DB (un outage de la tabla jamás desloguea a todo el mundo — decisión
 * documentada en sessions.ts), revocación de "las demás" excluyendo el sid
 * actual, y listado de activas.
 */

const mocks = vi.hoisted(() => {
  const insertReturning = vi.fn();
  const selectLimit = vi.fn();
  const updateWhere = vi.fn();
  const updateReturning = vi.fn();
  const orderBy = vi.fn();
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: insertReturning })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: selectLimit, orderBy })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn((..._args: unknown[]) => {
          const pending = updateWhere();
          return Object.assign(Promise.resolve(pending), {
            returning: updateReturning,
          });
        }),
      })),
    })),
  };
  return { db, insertReturning, selectLimit, updateWhere, updateReturning, orderBy };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));

const { mintSession, validateSession, revokeOtherSessions, listSessions } =
  await import("./sessions");

const USER_ID = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
const SID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateWhere.mockReturnValue(undefined);
});

describe("mintSession", () => {
  it("inserta y devuelve el sid", async () => {
    mocks.insertReturning.mockResolvedValue([{ id: SID }]);
    await expect(mintSession(USER_ID, "203.0.113.7", "vitest-agent")).resolves.toBe(SID);
    expect(mocks.db.insert).toHaveBeenCalledOnce();
  });

  it("fire-safe: DB caída (o tabla 0032 sin aplicar) → null, jamás lanza", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.insertReturning.mockRejectedValue(new Error('relation "user_sessions" does not exist'));
    await expect(mintSession(USER_ID)).resolves.toBeNull();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("insert sin fila devuelta → null", async () => {
    mocks.insertReturning.mockResolvedValue([]);
    await expect(mintSession(USER_ID)).resolves.toBeNull();
  });
});

describe("validateSession", () => {
  it("fila viva → valid:true y actualiza last_seen_at", async () => {
    mocks.selectLimit.mockResolvedValue([{ id: SID, revokedAt: null }]);
    await expect(validateSession(SID, USER_ID)).resolves.toEqual({ valid: true });
    expect(mocks.db.update).toHaveBeenCalledOnce();
  });

  it("fila inexistente → valid:false (sesión revocada por borrado)", async () => {
    mocks.selectLimit.mockResolvedValue([]);
    await expect(validateSession(SID, USER_ID)).resolves.toEqual({ valid: false });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("fila revocada → valid:false", async () => {
    mocks.selectLimit.mockResolvedValue([{ id: SID, revokedAt: new Date() }]);
    await expect(validateSession(SID, USER_ID)).resolves.toEqual({ valid: false });
  });

  it("FAIL-OPEN: error de DB → valid:true con console.error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.selectLimit.mockRejectedValue(new Error("connection refused"));
    await expect(validateSession(SID, USER_ID)).resolves.toEqual({ valid: true });
    expect(spy).toHaveBeenCalledOnce();
  });

  it("fallo del update de last_seen_at NO altera el veredicto", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.selectLimit.mockResolvedValue([{ id: SID, revokedAt: null }]);
    mocks.updateWhere.mockImplementation(() => {
      throw new Error("deadlock");
    });
    await expect(validateSession(SID, USER_ID)).resolves.toEqual({ valid: true });
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("revokeOtherSessions", () => {
  it("devuelve cuántas filas se revocaron", async () => {
    mocks.updateReturning.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    await expect(revokeOtherSessions(USER_ID, SID)).resolves.toBe(2);
    expect(mocks.db.update).toHaveBeenCalledOnce();
  });

  it("NO es fire-safe: un fallo de DB se propaga al caller", async () => {
    mocks.updateReturning.mockRejectedValue(new Error("connection refused"));
    await expect(revokeOtherSessions(USER_ID, SID)).rejects.toThrow("connection refused");
  });
});

describe("listSessions", () => {
  it("devuelve las sesiones activas ordenadas por last_seen_at", async () => {
    const rows = [{ id: SID, userId: USER_ID, revokedAt: null }];
    mocks.orderBy.mockResolvedValue(rows);
    await expect(listSessions(USER_ID)).resolves.toBe(rows);
  });
});
