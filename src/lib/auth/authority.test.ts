import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * Autoridad canónica (ADR-0036): rol, estado de cuenta y corte de credenciales
 * salen de Postgres, no del JWT.
 *
 * Estos casos reproducen los ataques que la auditoría del 2026-08-06 encontró
 * vivos: un token que sigue afirmando `role: "admin"` después de una
 * degradación, y una cookie robada que sobrevivía al cambio de contraseña.
 */

const rowMock = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => rowMock() }) }),
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  },
}));

const { resolveAuthority, isTokenRevoked } = await import("./authority");

const USER = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
const EMITIDO = 1_770_000_000; // segundos epoch, sintético
const corteEn = (segundos: number) => new Date(segundos * 1000);

beforeEach(() => rowMock.mockReset());

describe("isTokenRevoked", () => {
  test("sin corte registrado no revoca nada (comportamiento previo)", () => {
    expect(isTokenRevoked(EMITIDO, null)).toBe(false);
  });

  test("token emitido ANTES del corte queda revocado", () => {
    expect(isTokenRevoked(EMITIDO, corteEn(EMITIDO + 60))).toBe(true);
  });

  test("token emitido DESPUÉS del corte sigue siendo válido", () => {
    expect(isTokenRevoked(EMITIDO, corteEn(EMITIDO - 60))).toBe(false);
  });

  test("token del mismo segundo del corte sobrevive", () => {
    // Quien cambia su contraseña no debe expulsarse a sí mismo por el redondeo
    // de `iat` (segundos) frente al timestamp de Postgres (milisegundos).
    expect(isTokenRevoked(EMITIDO, corteEn(EMITIDO))).toBe(false);
    expect(isTokenRevoked(EMITIDO, new Date(EMITIDO * 1000 + 999))).toBe(false);
  });

  test("con corte activo, un token sin `iat` se rechaza (fail-closed)", () => {
    expect(isTokenRevoked(undefined, corteEn(EMITIDO))).toBe(true);
  });
});

describe("resolveAuthority — el JWT no es autoridad", () => {
  test("cuenta activa: devuelve el rol de la BASE", async () => {
    rowMock.mockResolvedValue([{ role: "admin", status: "active", sessionsValidFrom: null }]);
    const a = await resolveAuthority(USER, EMITIDO);
    expect(a).toEqual({ ok: true, userId: USER, role: "admin", isAdmin: true });
  });

  test("ATAQUE — admin degradado a staff: el token dice admin, la base manda", async () => {
    rowMock.mockResolvedValue([{ role: "staff", status: "active", sessionsValidFrom: null }]);
    const a = await resolveAuthority(USER, EMITIDO);
    expect(a.ok && a.isAdmin).toBe(false);
  });

  test("ATAQUE — cuenta borrada: la cookie sigue firmada pero no hay a quién autorizar", async () => {
    rowMock.mockResolvedValue([]);
    const a = await resolveAuthority(USER, EMITIDO);
    expect(a).toEqual({ ok: false, reason: "unknown_user" });
  });

  test("ATAQUE — cuenta suspendida: se rechaza aunque el token siga vigente", async () => {
    rowMock.mockResolvedValue([{ role: "admin", status: "suspended", sessionsValidFrom: null }]);
    const a = await resolveAuthority(USER, EMITIDO);
    expect(a).toEqual({ ok: false, reason: "suspended" });
  });

  test("cuenta 'invited' (contraseña sin fijar) tampoco opera", async () => {
    rowMock.mockResolvedValue([{ role: "staff", status: "invited", sessionsValidFrom: null }]);
    const a = await resolveAuthority(USER, EMITIDO);
    expect(a).toEqual({ ok: false, reason: "not_active" });
  });

  test("ATAQUE — cookie robada tras cambiar la contraseña: el corte la expulsa", async () => {
    rowMock.mockResolvedValue([
      { role: "admin", status: "active", sessionsValidFrom: corteEn(EMITIDO + 3600) },
    ]);
    const a = await resolveAuthority(USER, EMITIDO);
    expect(a).toEqual({ ok: false, reason: "credentials_changed" });
  });

  test("el token emitido DESPUÉS del cambio (la sesión nueva) sí entra", async () => {
    rowMock.mockResolvedValue([
      { role: "admin", status: "active", sessionsValidFrom: corteEn(EMITIDO) },
    ]);
    const a = await resolveAuthority(USER, EMITIDO + 3600);
    expect(a.ok).toBe(true);
  });
});
