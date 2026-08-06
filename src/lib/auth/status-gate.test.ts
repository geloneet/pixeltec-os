import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Puerta de estado del login (C-PR5): `authorize()` la ejecuta tras validar
 * la contraseña — solo `status='active'` entra; 'invited' y 'suspended' se
 * rechazan con el mismo veredicto que credenciales inválidas y dejan un
 * evento `login_failed` con metadata `{reason:'status'}` (fire-safe).
 */

const mocks = vi.hoisted(() => ({
  recordSecurityEvent: vi.fn(),
}));

vi.mock("@/lib/security/events", () => ({
  recordSecurityEvent: mocks.recordSecurityEvent,
}));

const { enforceStatusGate } = await import("./status-gate");

const USER_ID = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
const CTX = { ip: "203.0.113.7", userAgent: "vitest-agent" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recordSecurityEvent.mockResolvedValue(undefined);
});

describe("enforceStatusGate", () => {
  it("cuenta activa → ok, sin evento", async () => {
    await expect(
      enforceStatusGate({ id: USER_ID, status: "active" }, CTX)
    ).resolves.toBe("ok");
    expect(mocks.recordSecurityEvent).not.toHaveBeenCalled();
  });

  it.each(["invited", "suspended"] as const)(
    "cuenta %s → rejected + login_failed con metadata {reason:'status'}",
    async (status) => {
      await expect(
        enforceStatusGate({ id: USER_ID, status }, CTX)
      ).resolves.toBe("rejected");
      expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
        userId: USER_ID,
        type: "login_failed",
        ip: CTX.ip,
        userAgent: CTX.userAgent,
        metadata: { reason: "status", status },
      });
    }
  );

  it("fire-safe: fallo al registrar el evento no altera el veredicto", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.recordSecurityEvent.mockRejectedValue(new Error("db down"));
    await expect(
      enforceStatusGate({ id: USER_ID, status: "suspended" }, CTX)
    ).resolves.toBe("rejected");
    expect(spy).toHaveBeenCalledOnce();
  });
});
