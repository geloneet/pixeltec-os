import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

/**
 * Aceptación pública de invitación (C-PR5, /invitacion/[token]): requisitos
 * de contraseña de C-PR2, anti-enumeración (un solo código para token
 * inexistente/expirado/quemado/usuario no-'invited') y transacción única
 * contraseña + status 'active' + token quemado.
 */

const mocks = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    txUpdates: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  };

  function chain(rows: unknown[]): Record<string, unknown> {
    const p = Promise.resolve(rows) as Promise<unknown[]> & Record<string, unknown>;
    p.from = () => chain(rows);
    p.where = () => chain(rows);
    p.orderBy = () => chain(rows);
    p.innerJoin = () => chain(rows);
    p.limit = () => Promise.resolve(rows);
    return p;
  }

  const db = {
    select: vi.fn(() => chain(state.selectQueue.shift() ?? [])),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: (table: unknown) => ({
          set: (values: Record<string, unknown>) => ({
            where: () => {
              state.txUpdates.push({ table, values });
              return Promise.resolve(undefined);
            },
          }),
        }),
      };
      return fn(tx);
    }),
  };

  return {
    state,
    db,
    enforceRateLimit: vi.fn(),
    recordSecurityEvent: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("@/lib/security/events", () => ({
  recordSecurityEvent: mocks.recordSecurityEvent,
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7", "user-agent": "vitest" }),
}));

const { acceptInvitationAction, checkInvitationTokenAction } = await import(
  "./invitation-actions"
);
const schema = await import("@/lib/db/schema");

const TOKEN = "a".repeat(64);
const USER_ID = "bbbbbbbb-0000-4000-8000-000000000002";

function validRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    invitationId: "cccccccc-0000-4000-8000-000000000003",
    userId: USER_ID,
    userName: "Nueva",
    userStatus: "invited",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.selectQueue.length = 0;
  mocks.state.txUpdates.length = 0;
  mocks.enforceRateLimit.mockResolvedValue({ allowed: true });
  mocks.recordSecurityEvent.mockResolvedValue(undefined);
});

describe("acceptInvitationAction — validación de contraseña (C-PR2)", () => {
  it("confirmación distinta → mismatch, sin tocar la base", async () => {
    await expect(acceptInvitationAction(TOKEN, "abc12345", "otra1234")).resolves.toEqual({
      ok: false,
      error: "mismatch",
    });
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it("menos de 8 caracteres → too-short", async () => {
    await expect(acceptInvitationAction(TOKEN, "ab1", "ab1")).resolves.toEqual({
      ok: false,
      error: "too-short",
    });
  });

  it("sin letra o sin número → weak", async () => {
    await expect(acceptInvitationAction(TOKEN, "12345678", "12345678")).resolves.toEqual({
      ok: false,
      error: "weak",
    });
    await expect(acceptInvitationAction(TOKEN, "abcdefgh", "abcdefgh")).resolves.toEqual({
      ok: false,
      error: "weak",
    });
  });

  it("rate limit → rate-limited", async () => {
    mocks.enforceRateLimit.mockResolvedValue({ allowed: false });
    await expect(acceptInvitationAction(TOKEN, "abc12345", "abc12345")).resolves.toEqual({
      ok: false,
      error: "rate-limited",
    });
  });
});

describe("acceptInvitationAction — token", () => {
  it("token sin fila válida (inexistente/expirado/quemado) → invalid-token", async () => {
    mocks.state.selectQueue.push([]);
    await expect(acceptInvitationAction(TOKEN, "abc12345", "abc12345")).resolves.toEqual({
      ok: false,
      error: "invalid-token",
    });
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  it("usuario que ya no está 'invited' → mismo invalid-token (anti-enumeración)", async () => {
    mocks.state.selectQueue.push([validRow({ userStatus: "active" })]);
    await expect(acceptInvitationAction(TOKEN, "abc12345", "abc12345")).resolves.toEqual({
      ok: false,
      error: "invalid-token",
    });
  });

  it("token demasiado corto → invalid-token sin consultar la base", async () => {
    await expect(acceptInvitationAction("corto", "abc12345", "abc12345")).resolves.toEqual({
      ok: false,
      error: "invalid-token",
    });
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it("token válido: transacción fija bcrypt + status 'active' y quema el token; evento invitation_accepted", async () => {
    mocks.state.selectQueue.push([validRow()]);
    await expect(acceptInvitationAction(TOKEN, "abc12345", "abc12345")).resolves.toEqual({
      ok: true,
    });

    const usersUpdate = mocks.state.txUpdates.find((u) => u.table === schema.users);
    expect(usersUpdate?.values.status).toBe("active");
    const hash = String(usersUpdate?.values.passwordHash);
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(bcrypt.compare("abc12345", hash)).resolves.toBe(true);

    const burn = mocks.state.txUpdates.find((u) => u.table === schema.userInvitations);
    expect(burn?.values.usedAt).toBeInstanceOf(Date);

    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, type: "invitation_accepted" })
    );
  });
});

describe("checkInvitationTokenAction", () => {
  it("token válido → {valid:true, name}", async () => {
    mocks.state.selectQueue.push([validRow()]);
    await expect(checkInvitationTokenAction(TOKEN)).resolves.toEqual({
      valid: true,
      name: "Nueva",
    });
  });

  it("sin fila válida → {valid:false}", async () => {
    mocks.state.selectQueue.push([]);
    await expect(checkInvitationTokenAction(TOKEN)).resolves.toEqual({ valid: false });
  });

  it("error de DB → {valid:false} (nunca lanza hacia la página pública)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.db.select.mockImplementationOnce(() => {
      throw new Error("db down");
    });
    await expect(checkInvitationTokenAction(TOKEN)).resolves.toEqual({ valid: false });
    expect(spy).toHaveBeenCalledOnce();
  });
});
