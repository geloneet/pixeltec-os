import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Guards de rutas admin (WO-2026-00051).
 *
 * `requireAdmin` no cambia: admin pasa, staff y reviewer reciben 403.
 * `requireWhatsAppReviewAccess` (solo allowlist de /api/whatsapp-inbox):
 * admin y reviewer pasan; staff sigue en 403 exactamente como hoy.
 * Ambos releen la autoridad en Postgres (`resolveAuthority`), nunca el rol
 * del JWT.
 */

const { authMock, resolveAuthorityMock, insertValuesMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  resolveAuthorityMock: vi.fn(),
  insertValuesMock: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("@/lib/auth/config", () => ({ auth: authMock }));
vi.mock("@/lib/auth/authority", () => ({ resolveAuthority: resolveAuthorityMock }));
vi.mock("@/lib/db", () => ({
  db: { insert: () => ({ values: insertValuesMock }) },
}));

const { requireAdmin, requireWhatsAppReviewAccess } = await import("@/lib/auth-guards");

const UID = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
const CTX = { route: "/api/whatsapp-inbox/send", ip: "203.0.113.7", userAgent: "vitest" };

function sessionWithJwtRole(role: string) {
  // El rol del token se pone A PROPÓSITO distinto al de la base en varios
  // casos: los guards deben ignorarlo.
  return { user: { id: UID, role, credentialIssuedAt: 1_770_000_000 } };
}

function authority(role: "admin" | "staff" | "reviewer") {
  return { ok: true, userId: UID, role, isAdmin: role === "admin", sessionsValidFrom: null };
}

beforeEach(() => {
  authMock.mockReset();
  resolveAuthorityMock.mockReset();
  insertValuesMock.mockClear();
});

describe("requireWhatsAppReviewAccess", () => {
  test("sin sesión → 401", async () => {
    authMock.mockResolvedValue(null);
    expect(await requireWhatsAppReviewAccess(undefined, CTX)).toEqual({
      ok: false,
      error: "Unauthorized",
      status: 401,
    });
    expect(resolveAuthorityMock).not.toHaveBeenCalled();
  });

  test("reviewer (según Postgres) → ok, isAdmin=false", async () => {
    authMock.mockResolvedValue(sessionWithJwtRole("admin")); // JWT miente: admin
    resolveAuthorityMock.mockResolvedValue(authority("reviewer"));
    expect(await requireWhatsAppReviewAccess(undefined, CTX)).toEqual({
      ok: true,
      uid: UID,
      isAdmin: false,
    });
    expect(resolveAuthorityMock).toHaveBeenCalledWith(UID, 1_770_000_000);
  });

  test("admin → ok, isAdmin=true", async () => {
    authMock.mockResolvedValue(sessionWithJwtRole("reviewer")); // JWT miente: reviewer
    resolveAuthorityMock.mockResolvedValue(authority("admin"));
    expect(await requireWhatsAppReviewAccess(undefined, CTX)).toEqual({
      ok: true,
      uid: UID,
      isAdmin: true,
    });
  });

  test("staff → 403 auditado (igual que hoy con requireAdmin)", async () => {
    authMock.mockResolvedValue(sessionWithJwtRole("admin"));
    resolveAuthorityMock.mockResolvedValue(authority("staff"));
    expect(await requireWhatsAppReviewAccess(undefined, CTX)).toEqual({
      ok: false,
      error: "forbidden",
      status: 403,
    });
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "forbidden_access_attempt", uid: UID, route: CTX.route })
    );
  });

  test("cuenta suspendida / borrada / credenciales cambiadas → 401 aunque el JWT diga reviewer", async () => {
    authMock.mockResolvedValue(sessionWithJwtRole("reviewer"));
    for (const reason of ["suspended", "unknown_user", "credentials_changed", "not_active"]) {
      resolveAuthorityMock.mockResolvedValue({ ok: false, reason });
      expect(await requireWhatsAppReviewAccess(undefined, CTX), reason).toEqual({
        ok: false,
        error: "Unauthorized",
        status: 401,
      });
    }
  });
});

describe("requireAdmin — sin cambios", () => {
  test("admin → ok", async () => {
    authMock.mockResolvedValue(sessionWithJwtRole("admin"));
    resolveAuthorityMock.mockResolvedValue(authority("admin"));
    expect(await requireAdmin(undefined, CTX)).toEqual({ ok: true, uid: UID, isAdmin: true });
  });

  test("reviewer → 403 auditado (las rutas excluidas de la allowlist lo rechazan)", async () => {
    authMock.mockResolvedValue(sessionWithJwtRole("admin"));
    resolveAuthorityMock.mockResolvedValue(authority("reviewer"));
    expect(await requireAdmin(undefined, CTX)).toEqual({ ok: false, error: "forbidden", status: 403 });
    expect(insertValuesMock).toHaveBeenCalledTimes(1);
  });

  test("staff → 403", async () => {
    authMock.mockResolvedValue(sessionWithJwtRole("staff"));
    resolveAuthorityMock.mockResolvedValue(authority("staff"));
    expect(await requireAdmin(undefined, CTX)).toEqual({ ok: false, error: "forbidden", status: 403 });
  });

  test("sin contexto no audita (comportamiento previo)", async () => {
    authMock.mockResolvedValue(sessionWithJwtRole("staff"));
    resolveAuthorityMock.mockResolvedValue(authority("staff"));
    await requireAdmin();
    expect(insertValuesMock).not.toHaveBeenCalled();
  });
});
