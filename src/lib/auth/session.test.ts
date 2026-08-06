import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Gate A de la remediación de identidad.
 *
 * Lo que se protege aquí: que `users.id` sea la identidad de la sesión y que
 * `firebaseUid` no condicione el acceso. El defecto original —una cuenta sin
 * `firebaseUid` tratada como no autenticada pese a tener sesión válida— tiene
 * su propio caso, marcado como comportamiento heredado a retirar en el Gate B.
 */

const authMock = vi.fn();
vi.mock("@/lib/auth/config", () => ({ auth: () => authMock() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// C-PR3: el callback `jwt` importa dinámicamente ./sessions (mint/validate).
// Se mockea para que estos tests jamás toquen `@/lib/db` (postgres real) y
// para poder afirmar cuándo se acuña y cuándo se revalida el sid.
const sessionsMock = vi.hoisted(() => ({
  mintSession: vi.fn(async (): Promise<string | null> => "sid-acunado"),
  validateSession: vi.fn(async () => ({ valid: true })),
  revokeOtherSessions: vi.fn(),
  listSessions: vi.fn(),
}));
vi.mock("./sessions", () => sessionsMock);

// La frontera de sesión consulta la autoridad canónica (rol/status/corte de
// credenciales). Aquí se prueba la resolución de IDENTIDAD, no la
// autorización —que tiene su propio archivo—, así que se responde "cuenta
// activa, rol staff, sin corte" por defecto.
let authorityRole: "admin" | "staff" = "staff";
const authorityMock = vi.fn(async (userId: string) => ({
  ok: true as const,
  userId,
  role: authorityRole,
  isAdmin: authorityRole === "admin",
}));
vi.mock("./authority", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./authority")>()),
  resolveAuthority: (userId: string) => authorityMock(userId),
}));

const { getSessionUserId, requireUserSession } = await import("./session");
const { authConfig, AUTH_SESSION_USER_ID_MISSING } = await import("./auth.config");

const USER_ID = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
const LEGACY_UID = "jO09XxAbCdEfGhIjKlMnOpQrStUv";

/** Sesión de una cuenta anterior a la migración: conserva el alias heredado. */
const sessionConPuente = {
  user: { id: USER_ID, role: "admin", firebaseUid: LEGACY_UID, email: "con-puente@ejemplo.mx" },
};

/** Sesión de una cuenta creada después de la migración: sin alias. */
const sessionSinPuente = {
  user: { id: USER_ID, role: "staff", firebaseUid: null, email: "sin-puente@ejemplo.mx" },
};

beforeEach(() => {
  authMock.mockReset();
  authorityRole = "staff";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getSessionUserId", () => {
  it("devuelve users.id para una cuenta con firebase_uid", async () => {
    authMock.mockResolvedValue(sessionConPuente);
    await expect(getSessionUserId()).resolves.toBe(USER_ID);
  });

  it("devuelve users.id para una cuenta SIN firebase_uid — el defecto que se corrige", async () => {
    authMock.mockResolvedValue(sessionSinPuente);
    await expect(getSessionUserId()).resolves.toBe(USER_ID);
  });

  it("resuelve al MISMO users.id con y sin puente: el alias no altera la identidad", async () => {
    authMock.mockResolvedValue(sessionConPuente);
    const conPuente = await getSessionUserId();
    authMock.mockResolvedValue(sessionSinPuente);
    const sinPuente = await getSessionUserId();
    expect(conPuente).toBe(sinPuente);
  });

  it("devuelve null sin sesión, en silencio: es el flujo normal de un visitante", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    authMock.mockResolvedValue(null);
    await expect(getSessionUserId()).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("ante una sesión autenticada sin id falla explícitamente, no devuelve null", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    authMock.mockResolvedValue({ user: { role: "admin", firebaseUid: LEGACY_UID } });
    await expect(getSessionUserId()).rejects.toThrow(AUTH_SESSION_USER_ID_MISSING);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("rechaza también una cadena vacía: '' no es una identidad válida", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    authMock.mockResolvedValue({ user: { id: "", role: "admin" } });
    await expect(getSessionUserId()).rejects.toThrow(AUTH_SESSION_USER_ID_MISSING);
  });

  it("nunca devuelve cadena vacía en ninguna entrada plausible", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const entradas = [
      null,
      { user: { id: USER_ID } },
      { user: { id: "" } },
      { user: { role: "admin" } },
    ];
    for (const entrada of entradas) {
      authMock.mockResolvedValue(entrada);
      const resultado = await getSessionUserId().catch(() => "LANZÓ");
      expect(resultado).not.toBe("");
    }
  });

  it("no consulta firebaseUid para resolver identidad", async () => {
    const acceso = vi.fn();
    const user = { id: USER_ID, role: "admin", email: "x@ejemplo.mx" };
    authMock.mockResolvedValue({
      user: new Proxy(user, {
        get(target, prop, receiver) {
          if (prop === "firebaseUid") acceso();
          return Reflect.get(target, prop, receiver);
        },
      }),
    });
    await expect(getSessionUserId()).resolves.toBe(USER_ID);
    expect(acceso).not.toHaveBeenCalled();
  });
});


describe("contrato del token y de la sesión", () => {
  const jwt = authConfig.callbacks!.jwt!;
  const session = authConfig.callbacks!.session!;

  // Los callbacks de NextAuth reciben más campos de los que usan. Se invocan
  // con el subconjunto relevante a través de una firma mínima, en vez de
  // reconstruir el tipo completo de la librería solo para el test.
  type Campos = Record<string, unknown>;
  type JwtCb = (args: { token: Campos; user?: Campos }) => Promise<Campos> | Campos;
  type SessionCb = (args: { session: { user: Campos }; token: Campos }) =>
    | Promise<{ user: Campos }>
    | { user: Campos };

  const sellar = (user: Campos) => (jwt as unknown as JwtCb)({ token: {}, user });

  const proyectar = (token: Campos) =>
    (session as unknown as SessionCb)({ session: { user: {} }, token });

  it("el JWT contiene users.id", async () => {
    const token = await sellar({ id: USER_ID, role: "admin", firebaseUid: LEGACY_UID });
    expect(token.id).toBe(USER_ID);
  });

  it("el JWT contiene users.id también sin puente", async () => {
    const token = await sellar({ id: USER_ID, role: "staff", firebaseUid: null });
    expect(token.id).toBe(USER_ID);
    // Gate B6: el alias ya no se sella en el JWT.
    expect(token.firebaseUid).toBeUndefined();
  });

  it("la sesión propaga users.id desde el token", async () => {
    const s = await proyectar({ id: USER_ID, role: "admin" });
    expect(s.user.id).toBe(USER_ID);
  });

  it("el rol sigue derivándose de users.role, no del puente", async () => {
    const token = await sellar({ id: USER_ID, role: "staff", firebaseUid: null });
    const s = await proyectar(token);
    expect(s.user.role).toBe("staff");
  });

  it("el alias Firebase ya no viaja en la sesion (Gate B6)", async () => {
    const token = await sellar({ id: USER_ID, role: "admin" });
    const s = await proyectar(token);
    expect(s.user.id).toBe(USER_ID);
    expect(s.user.firebaseUid).toBeUndefined();
  });

  it("un token sin id no produce sesión: lanza y lo registra", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => proyectar({ role: "admin" })).toThrow(AUTH_SESSION_USER_ID_MISSING);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("un token con id vacío tampoco produce sesión", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => proyectar({ id: "", role: "admin" })).toThrow(AUTH_SESSION_USER_ID_MISSING);
  });

  it("el error registrado no incluye el token ni datos de la sesión", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => proyectar({ role: "admin", firebaseUid: LEGACY_UID })).toThrow();
    const mensaje = spy.mock.calls.flat().join(" ");
    expect(mensaje).not.toContain(LEGACY_UID);
    expect(mensaje).not.toContain(USER_ID);
  });
});

/**
 * Gate B1 (Firebase Exit): frontera canónica `requireUserSession` — contrato
 * {userId, email, role?} sin `firebaseUid`. Cuentas sin alias operan igual.
 */
describe("requireUserSession (Gate B1)", () => {
  it("admin histórico CON alias: contrato canónico, jamás expone el alias", async () => {
    authMock.mockResolvedValue(sessionConPuente);
    authorityRole = "admin";
    const s = await requireUserSession();
    expect(s).toEqual({ userId: USER_ID, email: "con-puente@ejemplo.mx", role: "admin" });
    expect(s).not.toHaveProperty("firebaseUid");
  });

  it("el `role` sale de la BASE, no del JWT (ADR-0036: el token no es autoridad)", async () => {
    // El token dice "admin" —sellado al autenticar— pero la cuenta ya fue
    // degradada a staff. Gana la base.
    authMock.mockResolvedValue(sessionConPuente);
    authorityRole = "staff";
    const s = await requireUserSession();
    expect(s?.role).toBe("staff");
  });

  it("staff con firebaseUid = null AUTENTICA igual — el defecto queda corregido", async () => {
    authMock.mockResolvedValue(sessionSinPuente);
    const s = await requireUserSession();
    expect(s).toEqual({ userId: USER_ID, email: "sin-puente@ejemplo.mx", role: "staff" });
  });

  it("usuario nuevo post-migración (sin campo firebaseUid en absoluto)", async () => {
    authMock.mockResolvedValue({ user: { id: USER_ID, email: "nuevo@ejemplo.mx" } });
    authorityRole = "staff";
    const s = await requireUserSession();
    // `role` ya no depende de que el JWT lo traiga: lo resuelve la base.
    expect(s).toEqual({ userId: USER_ID, email: "nuevo@ejemplo.mx", role: "staff" });
  });

  it("sin sesión → null, en silencio (401/redirect es del caller)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    authMock.mockResolvedValue(null);
    await expect(requireUserSession()).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("usuario desactivado/eliminado (el callback ya no emite sesión) → null", async () => {
    authMock.mockResolvedValue({ user: undefined });
    await expect(requireUserSession()).resolves.toBeNull();
  });

  it("sesión corrupta sin users.id → LANZA, no degrada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    authMock.mockResolvedValue({ user: { email: "x@ejemplo.mx", firebaseUid: LEGACY_UID } });
    await expect(requireUserSession()).rejects.toThrow(AUTH_SESSION_USER_ID_MISSING);
  });

  it("sesión sin email → LANZA (invariante del contrato)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    authMock.mockResolvedValue({ user: { id: USER_ID, role: "staff" } });
    await expect(requireUserSession()).rejects.toThrow(AUTH_SESSION_USER_ID_MISSING);
  });
});

/**
 * C-PR3: sid de `user_sessions` en el JWT — sellado en login, acuñado
 * perezoso para tokens legacy, y revalidación con throttle de 60s cuyo
 * veredicto negativo mata la sesión (return null). Los errores de la capa
 * de sesiones jamás matan un token firmado (fail-open).
 */
describe("callback jwt — sid de sesión revocable (C-PR3)", () => {
  const SID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
  type Campos = Record<string, unknown>;
  type JwtCb = (args: { token: Campos; user?: Campos }) => Promise<Campos | null>;
  const jwt = authConfig.callbacks!.jwt! as unknown as JwtCb;

  beforeEach(() => {
    sessionsMock.mintSession.mockReset().mockResolvedValue("sid-acunado");
    sessionsMock.validateSession.mockReset().mockResolvedValue({ valid: true });
  });

  it("login: sella el sid que acuñó authorize(), sin mint adicional", async () => {
    const token = await jwt({ token: {}, user: { id: USER_ID, role: "admin", sid: SID } });
    expect(token?.sid).toBe(SID);
    expect(sessionsMock.mintSession).not.toHaveBeenCalled();
    expect(typeof token?.chk).toBe("number");
  });

  it("login cuyo mint de authorize falló (sid null) → acuñado perezoso", async () => {
    const token = await jwt({ token: {}, user: { id: USER_ID, role: "staff", sid: null } });
    expect(sessionsMock.mintSession).toHaveBeenCalledWith(USER_ID);
    expect(token?.sid).toBe("sid-acunado");
  });

  it("token legacy sin sid → acuñado perezoso, NO se invalida", async () => {
    const token = await jwt({ token: { id: USER_ID, role: "admin" } });
    expect(sessionsMock.mintSession).toHaveBeenCalledWith(USER_ID);
    expect(token?.sid).toBe("sid-acunado");
    expect(sessionsMock.validateSession).not.toHaveBeenCalled();
  });

  it("acuñado perezoso fallido (fire-safe null) → el token sobrevive sin sid", async () => {
    sessionsMock.mintSession.mockResolvedValue(null);
    const token = await jwt({ token: { id: USER_ID } });
    expect(token).not.toBeNull();
    expect(token?.sid).toBeUndefined();
  });

  it("chk reciente → no revalida contra la DB (throttle)", async () => {
    const token = await jwt({ token: { id: USER_ID, sid: SID, chk: Date.now() } });
    expect(sessionsMock.validateSession).not.toHaveBeenCalled();
    expect(token?.sid).toBe(SID);
  });

  it("chk viejo + sesión válida → revalida y renueva chk", async () => {
    const viejo = Date.now() - 61_000;
    const token = await jwt({ token: { id: USER_ID, sid: SID, chk: viejo } });
    expect(sessionsMock.validateSession).toHaveBeenCalledWith(SID, USER_ID);
    expect(token?.chk as number).toBeGreaterThan(viejo);
  });

  it("chk viejo + sesión REVOCADA → devuelve null (mata la sesión)", async () => {
    sessionsMock.validateSession.mockResolvedValue({ valid: false });
    const token = await jwt({ token: { id: USER_ID, sid: SID, chk: Date.now() - 120_000 } });
    expect(token).toBeNull();
  });

  it("error inesperado de la capa de sesiones → el token sobrevive (fail-open)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    sessionsMock.validateSession.mockRejectedValue(new Error("db down"));
    const token = await jwt({ token: { id: USER_ID, sid: SID, chk: 0 } });
    expect(token).not.toBeNull();
    expect(token?.sid).toBe(SID);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("la sesión proyecta el sid del token (para revokeOtherSessionsAction)", async () => {
    type SessionCb = (args: { session: { user: Campos }; token: Campos }) => { user: Campos };
    const session = authConfig.callbacks!.session! as unknown as SessionCb;
    const s = session({ session: { user: {} }, token: { id: USER_ID, sid: SID } });
    expect(s.user.sid).toBe(SID);
  });
});
