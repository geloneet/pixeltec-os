import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Contrato FIRE-SAFE del escritor único de `security_events` (C-PR2).
 *
 * La tabla llega con la migración 0031, que NO se aplica desde la rama —
 * entre el deploy del código y el deploy gobernado de la migración, la tabla
 * puede no existir. `recordSecurityEvent` debe tolerar eso (y cualquier otra
 * caída de Postgres) sin propagar jamás la excepción al flujo que audita.
 */

const mocks = vi.hoisted(() => ({
  valuesMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { insert: vi.fn(() => ({ values: mocks.valuesMock })) },
}));

const { recordSecurityEvent } = await import("./events");

beforeEach(() => {
  mocks.valuesMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordSecurityEvent", () => {
  it("no propaga cuando la tabla no existe todavía (0031 sin aplicar)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.valuesMock.mockRejectedValue(new Error('relation "security_events" does not exist'));

    await expect(
      recordSecurityEvent({ userId: "u-1", type: "login_success", ip: "203.0.113.7" })
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledOnce();
  });

  it("no propaga ante cualquier otro fallo del backend", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.valuesMock.mockRejectedValue(new Error("connection refused"));

    await expect(
      recordSecurityEvent({ userId: "u-1", type: "password_changed" })
    ).resolves.toBeUndefined();
  });

  it("inserta el evento con los opcionales normalizados a null", async () => {
    mocks.valuesMock.mockResolvedValue(undefined);

    await recordSecurityEvent({ userId: "u-1", type: "login_failed", ip: "198.51.100.2" });

    expect(mocks.valuesMock).toHaveBeenCalledWith({
      userId: "u-1",
      actorUserId: null,
      type: "login_failed",
      ip: "198.51.100.2",
      userAgent: null,
      metadata: null,
    });
  });
});
