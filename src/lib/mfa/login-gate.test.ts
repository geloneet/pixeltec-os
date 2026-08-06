import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Puerta MFA del login (C-PR4) — el flujo que ejecuta `authorize()` tras
 * validar la contraseña: sin MFA pasa, con MFA exige código, TOTP con
 * anti-replay persistido, recovery de un solo uso (quemado + evento), y los
 * contratos de fallo (lectura fail-open, escritura del paso fail-closed).
 */

const mocks = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const updateWhere = vi.fn();
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: selectLimit })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: updateWhere })),
    })),
  };
  return {
    db,
    selectLimit,
    updateWhere,
    recordSecurityEvent: vi.fn(),
    decryptSecret: vi.fn(),
    verifyTotp: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/security/events", () => ({ recordSecurityEvent: mocks.recordSecurityEvent }));
vi.mock("./crypto", () => ({ decryptSecret: mocks.decryptSecret }));
vi.mock("./totp", async (importOriginal) => {
  const real = await importOriginal<typeof import("./totp")>();
  return { ...real, verifyTotp: mocks.verifyTotp };
});

const { enforceMfaGate } = await import("./login-gate");
const { hashRecoveryCode } = await import("./totp");

const USER_ID = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
const SECRET = "QELXWLPL4ZQXNGRXMIFDIGIZKQUXYYT5";
const MFA_ROW = {
  userId: USER_ID,
  secretEnc: "iv:tag:ct",
  enabledAt: new Date("2026-08-01T00:00:00Z"),
  lastUsedStep: 100,
  createdAt: new Date("2026-07-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.decryptSecret.mockReturnValue(SECRET);
  mocks.updateWhere.mockResolvedValue(undefined);
});

describe("cuentas sin MFA", () => {
  it("sin fila en user_mfa → no-mfa", async () => {
    mocks.selectLimit.mockResolvedValue([]);
    await expect(enforceMfaGate(USER_ID, undefined)).resolves.toBe("no-mfa");
  });

  it("enrolamiento pendiente (enabled_at NULL) NO exige código", async () => {
    mocks.selectLimit.mockResolvedValue([{ ...MFA_ROW, enabledAt: null }]);
    await expect(enforceMfaGate(USER_ID, undefined)).resolves.toBe("no-mfa");
  });

  it("FAIL-OPEN: tabla 0033 sin aplicar / DB caída → no-mfa con console.error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.selectLimit.mockRejectedValue(new Error('relation "user_mfa" does not exist'));
    await expect(enforceMfaGate(USER_ID, undefined)).resolves.toBe("no-mfa");
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("cuentas con MFA activa — TOTP", () => {
  beforeEach(() => {
    mocks.selectLimit.mockResolvedValue([MFA_ROW]);
  });

  it("sin código → required (el login UI revela el campo)", async () => {
    await expect(enforceMfaGate(USER_ID, undefined)).resolves.toBe("required");
    await expect(enforceMfaGate(USER_ID, "   ")).resolves.toBe("required");
  });

  it("TOTP válido → ok y persiste el paso (anti-replay)", async () => {
    mocks.verifyTotp.mockResolvedValue({ ok: true, step: 101 });
    await expect(enforceMfaGate(USER_ID, "123456")).resolves.toBe("ok");
    expect(mocks.verifyTotp).toHaveBeenCalledWith(SECRET, "123456", 100);
    expect(mocks.db.update).toHaveBeenCalledOnce();
  });

  it("TOTP inválido o repetido (verifyTotp aplica last_used_step) → failed", async () => {
    mocks.verifyTotp.mockResolvedValue({ ok: false });
    await expect(enforceMfaGate(USER_ID, "123456")).resolves.toBe("failed");
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("FAIL-CLOSED: no se pudo persistir el paso → failed (sin anti-replay no hay ok)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.verifyTotp.mockResolvedValue({ ok: true, step: 101 });
    mocks.updateWhere.mockRejectedValue(new Error("deadlock"));
    await expect(enforceMfaGate(USER_ID, "123456")).resolves.toBe("failed");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("MFA_ENCRYPTION_KEY ausente/rotada (decrypt lanza) → failed con console.error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.decryptSecret.mockImplementation(() => {
      throw new Error("MFA_ENCRYPTION_KEY no está configurada");
    });
    await expect(enforceMfaGate(USER_ID, "123456")).resolves.toBe("failed");
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("cuentas con MFA activa — código de recuperación", () => {
  const RECOVERY = "AB2CD3EF45";

  it("código sin usar → ok, se quema y registra mfa_recovery_used", async () => {
    mocks.selectLimit
      .mockResolvedValueOnce([MFA_ROW]) // user_mfa
      .mockResolvedValueOnce([{ id: "rc-1" }]); // recovery hash match
    const result = await enforceMfaGate(USER_ID, ` ${RECOVERY.toLowerCase()} `, {
      ip: "203.0.113.7",
      userAgent: "vitest-agent",
    });
    expect(result).toBe("ok");
    // Quemado: update de used_at sobre la fila encontrada.
    expect(mocks.db.update).toHaveBeenCalledOnce();
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      userId: USER_ID,
      type: "mfa_recovery_used",
      ip: "203.0.113.7",
      userAgent: "vitest-agent",
    });
    // El TOTP no participa en el camino recovery.
    expect(mocks.verifyTotp).not.toHaveBeenCalled();
  });

  it("código desconocido o ya quemado (sin fila sin usar) → failed", async () => {
    mocks.selectLimit
      .mockResolvedValueOnce([MFA_ROW])
      .mockResolvedValueOnce([]);
    await expect(enforceMfaGate(USER_ID, RECOVERY)).resolves.toBe("failed");
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.recordSecurityEvent).not.toHaveBeenCalled();
  });

  it("el hash consultado es el sha256 del código normalizado", () => {
    // Garantiza que gate y enrolamiento comparten normalización (totp.ts).
    expect(hashRecoveryCode(` ${RECOVERY.toLowerCase()} `)).toBe(hashRecoveryCode(RECOVERY));
  });
});
