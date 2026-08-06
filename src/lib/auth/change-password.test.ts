import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `changePasswordAction` v2 (C-PR2): validación zod (mismatch/too-short/weak),
 * rate-limit por usuario, transacción hash+invalidación de resets, y
 * post-cambio fire-safe (evento `password_changed` + aviso por correo cuyo
 * fallo JAMÁS convierte un cambio ya aplicado en error).
 */

const mocks = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const txWhere = vi.fn();
  const txSet = vi.fn(() => ({ where: txWhere }));
  const txUpdate = vi.fn(() => ({ set: txSet }));
  const tx = { update: txUpdate };
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: selectLimit })),
      })),
    })),
    transaction: vi.fn(async (cb: (t: typeof tx) => Promise<void>) => cb(tx)),
  };
  return {
    auth: vi.fn(),
    enforceRateLimit: vi.fn(),
    recordSecurityEvent: vi.fn(),
    sendPasswordChangedEmail: vi.fn(),
    logSystemAlert: vi.fn(),
    compare: vi.fn(),
    hash: vi.fn(),
    selectLimit,
    txWhere,
    txSet,
    txUpdate,
    db,
  };
});

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "vitest-agent" }),
}));
vi.mock("@/lib/auth/config", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("@/lib/security/events", () => ({ recordSecurityEvent: mocks.recordSecurityEvent }));
vi.mock("@/lib/email", () => ({ sendPasswordChangedEmail: mocks.sendPasswordChangedEmail }));
vi.mock("@/lib/system-alerts", () => ({ logSystemAlert: mocks.logSystemAlert }));
vi.mock("bcryptjs", () => ({
  default: { compare: mocks.compare, hash: mocks.hash },
}));

const { changePasswordAction } = await import("./actions");

const USER_ID = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
const USER_ROW = {
  id: USER_ID,
  email: "staff@pixeltec.mx",
  name: "Staff",
  passwordHash: "$2a$12$hash-actual",
};

function armHappyPath() {
  mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
  mocks.enforceRateLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSec: 0 });
  mocks.selectLimit.mockResolvedValue([USER_ROW]);
  mocks.compare.mockResolvedValue(true);
  mocks.hash.mockResolvedValue("$2a$12$hash-nuevo");
  mocks.sendPasswordChangedEmail.mockResolvedValue({ success: true, id: "email-1" });
  mocks.recordSecurityEvent.mockResolvedValue(undefined);
  mocks.logSystemAlert.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validación (antes de tocar sesión/DB)", () => {
  it("campos vacíos → unknown, sin consultar sesión", async () => {
    const result = await changePasswordAction("", "abcd1234", "abcd1234");
    expect(result).toEqual({ ok: false, error: "unknown" });
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("confirmación distinta → mismatch", async () => {
    const result = await changePasswordAction("actual1", "abcd1234", "abcd1235");
    expect(result).toEqual({ ok: false, error: "mismatch" });
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("menos de 8 caracteres → too-short", async () => {
    const result = await changePasswordAction("actual1", "a1b2", "a1b2");
    expect(result).toEqual({ ok: false, error: "too-short" });
  });

  it("sin número → weak", async () => {
    const result = await changePasswordAction("actual1", "abcdefgh", "abcdefgh");
    expect(result).toEqual({ ok: false, error: "weak" });
  });

  it("sin letra → weak", async () => {
    const result = await changePasswordAction("actual1", "12345678", "12345678");
    expect(result).toEqual({ ok: false, error: "weak" });
  });
});

describe("sesión y rate-limit", () => {
  it("sin sesión → no-session", async () => {
    mocks.auth.mockResolvedValue(null);
    const result = await changePasswordAction("actual1", "abcd1234", "abcd1234");
    expect(result).toEqual({ ok: false, error: "no-session" });
  });

  it("bucket change_password agotado → rate-limited, con el userId como clave", async () => {
    armHappyPath();
    mocks.enforceRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSec: 600 });

    const result = await changePasswordAction("actual1", "abcd1234", "abcd1234");

    expect(result).toEqual({ ok: false, error: "rate-limited" });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      bucket: "change_password",
      ip: USER_ID,
      max: 5,
      windowMs: 15 * 60_000,
    });
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });
});

describe("flujo principal", () => {
  it("contraseña actual incorrecta → wrong-password, sin transacción", async () => {
    armHappyPath();
    mocks.compare.mockResolvedValue(false);

    const result = await changePasswordAction("actual1", "abcd1234", "abcd1234");

    expect(result).toEqual({ ok: false, error: "wrong-password" });
    expect(mocks.db.transaction).not.toHaveBeenCalled();
    expect(mocks.recordSecurityEvent).not.toHaveBeenCalled();
  });

  it("éxito: transacción (hash + invalidación de resets), evento y aviso", async () => {
    armHappyPath();

    const result = await changePasswordAction("actual1", "abcd1234", "abcd1234");

    expect(result).toEqual({ ok: true });
    expect(mocks.hash).toHaveBeenCalledWith("abcd1234", 12);
    // Dos updates dentro de la MISMA transacción: users + password_reset_tokens
    expect(mocks.db.transaction).toHaveBeenCalledOnce();
    expect(mocks.txUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      userId: USER_ID,
      type: "password_changed",
      ip: "203.0.113.7",
      userAgent: "vitest-agent",
    });
    expect(mocks.sendPasswordChangedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: USER_ROW.email, name: USER_ROW.name })
    );
    expect(mocks.logSystemAlert).not.toHaveBeenCalled();
  });

  it("fallo del envío de correo → ok:true igual + logSystemAlert warning", async () => {
    armHappyPath();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendPasswordChangedEmail.mockResolvedValue({
      success: false,
      error: "email_provider_failed",
    });

    const result = await changePasswordAction("actual1", "abcd1234", "abcd1234");

    expect(result).toEqual({ ok: true });
    expect(mocks.logSystemAlert).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "warning", source: "password_change" })
    );
  });

  it("throw inesperado del correo → ok:true igual (fire-safe)", async () => {
    armHappyPath();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendPasswordChangedEmail.mockRejectedValue(new Error("resend down"));

    const result = await changePasswordAction("actual1", "abcd1234", "abcd1234");

    expect(result).toEqual({ ok: true });
  });

  it("transacción falla → unknown, sin evento ni correo", async () => {
    armHappyPath();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.db.transaction.mockRejectedValue(new Error("deadlock"));

    const result = await changePasswordAction("actual1", "abcd1234", "abcd1234");

    expect(result).toEqual({ ok: false, error: "unknown" });
    expect(mocks.recordSecurityEvent).not.toHaveBeenCalled();
    expect(mocks.sendPasswordChangedEmail).not.toHaveBeenCalled();
  });
});
