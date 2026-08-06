import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * REGRESIÓN del bypass completo de revocación de credenciales.
 *
 * El primer intento de este fix usaba `token.iat` como epoch. Auth.js reemite
 * la cookie y **refresca `iat`** en cada rotación, así que la secuencia
 * "cambio la contraseña → visito /api/auth/session" devolvía una cookie nueva
 * con `iat` posterior al corte: la sesión robada se renovaba sola y el corte no
 * revocaba **jamás**.
 *
 * Esta prueba recorre el callback `jwt` real —el punto por el que pasa toda
 * reemisión— con un token antiguo y un corte ya estampado, y exige que la
 * sesión muera (`null`, que Auth.js traduce en borrado de cookie).
 */

const authorityRow = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => authorityRow() }) }),
    }),
  },
}));

// El tracking por dispositivo no participa de esta regresión: se neutraliza
// para que el veredicto salga solo de la autoridad de credenciales.
vi.mock("./sessions", () => ({
  mintSession: async () => null,
  validateSession: async () => ({ valid: true }),
}));

const { authConfig } = await import("./auth.config");

const USER = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
const LOGIN_AT = 1_770_000_000; // segundos epoch, sintético
const jwtCallback = authConfig.callbacks!.jwt!;

/** Invoca el callback como lo hace Auth.js al reemitir (sin `user`). */
const reissue = (token: Record<string, unknown>) =>
  jwtCallback({ token, user: undefined, trigger: undefined, session: undefined } as never);

const activo = (sessionsValidFrom: Date | null, role: "admin" | "staff" = "admin") =>
  authorityRow.mockResolvedValue([{ role, status: "active", sessionsValidFrom }]);

beforeEach(() => {
  authorityRow.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("bypass completo: token antiguo → cambio de contraseña → /api/auth/session", () => {
  test("la cookie NO se renueva como válida: la sesión se destruye", async () => {
    // 1. Sesión iniciada antes del cambio.
    const tokenRobado = {
      id: USER,
      role: "admin",
      credentialIssuedAt: LOGIN_AT,
      // 2. La cookie ya rotó varias veces: `iat` es RECIENTE, posterior al
      //    corte. Es exactamente el dato que hacía inútil el diseño anterior.
      iat: LOGIN_AT + 7200,
    };

    // 3. Entretanto, el usuario cambió su contraseña.
    activo(new Date((LOGIN_AT + 3600) * 1000));

    // 4. El atacante pega /api/auth/session para refrescar su cookie.
    const resultado = await reissue(tokenRobado);

    // `null` ⇒ Auth.js destruye la sesión y borra la cookie.
    expect(resultado).toBeNull();
  });

  test("un `iat` fresco no puede rescatar una credencial vieja", async () => {
    activo(new Date((LOGIN_AT + 3600) * 1000));
    // Aunque `iat` sea de ahora mismo, lo que decide es el claim inmutable.
    const resultado = await reissue({
      id: USER,
      role: "admin",
      credentialIssuedAt: LOGIN_AT,
      iat: Math.floor(Date.now() / 1000),
    });
    expect(resultado).toBeNull();
  });

  test("la sesión abierta DESPUÉS del cambio sigue viva", async () => {
    const corte = LOGIN_AT + 3600;
    activo(new Date(corte * 1000));
    const resultado = await reissue({
      id: USER,
      role: "admin",
      credentialIssuedAt: corte + 5,
      iat: corte + 5,
    });
    expect(resultado).not.toBeNull();
  });
});

describe("el claim de credencial es inmutable en las rotaciones", () => {
  test("una reemisión no reescribe credentialIssuedAt", async () => {
    activo(null);
    const resultado = (await reissue({
      id: USER,
      role: "admin",
      credentialIssuedAt: LOGIN_AT,
      iat: LOGIN_AT + 9999,
    })) as Record<string, unknown> | null;

    expect(resultado?.credentialIssuedAt).toBe(LOGIN_AT);
  });

  test("solo el login (con `user`) acuña el claim", async () => {
    activo(null);
    const emitido = (await jwtCallback({
      token: {},
      user: { id: USER, role: "admin" },
      trigger: "signIn",
      session: undefined,
    } as never)) as Record<string, unknown> | null;

    expect(typeof emitido?.credentialIssuedAt).toBe("number");
  });
});

describe("token legacy sin claim", () => {
  test("sin corte: se le inicializa el claim y sobrevive", async () => {
    activo(null);
    const resultado = (await reissue({ id: USER, role: "admin", iat: LOGIN_AT })) as Record<
      string,
      unknown
    > | null;

    expect(resultado).not.toBeNull();
    expect(typeof resultado?.credentialIssuedAt).toBe("number");
  });

  test("ATAQUE — con corte activo: se rechaza en vez de inicializarse", async () => {
    // Inicializar aquí le daría una fecha nueva, posterior al corte: sería
    // regalarle al token exactamente el bypass que se está cerrando.
    activo(new Date((LOGIN_AT + 3600) * 1000));
    const resultado = await reissue({ id: USER, role: "admin", iat: LOGIN_AT });
    expect(resultado).toBeNull();
  });
});

describe("el rol se refresca desde Postgres en cada reemisión", () => {
  test("un admin degradado a staff deja de viajar como admin", async () => {
    activo(null, "staff");
    const resultado = (await reissue({
      id: USER,
      role: "admin", // lo que sellaba el token al autenticar
      credentialIssuedAt: LOGIN_AT,
      iat: LOGIN_AT,
    })) as Record<string, unknown> | null;

    expect(resultado?.role).toBe("staff");
  });

  test("una cuenta suspendida destruye la sesión", async () => {
    authorityRow.mockResolvedValue([
      { role: "admin", status: "suspended", sessionsValidFrom: null },
    ]);
    const resultado = await reissue({ id: USER, role: "admin", credentialIssuedAt: LOGIN_AT });
    expect(resultado).toBeNull();
  });

  test("una cuenta borrada destruye la sesión", async () => {
    authorityRow.mockResolvedValue([]);
    const resultado = await reissue({ id: USER, role: "admin", credentialIssuedAt: LOGIN_AT });
    expect(resultado).toBeNull();
  });
});
