import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  assertMetaEgressAllowed,
  EgressBlockedError,
  type MetaOperation,
} from "@/lib/egress-guard";
import {
  exchangeCodeForToken,
  getFacebookPages,
  getFacebookUser,
  getInstagramUsername,
  debugToken,
  createInstagramMediaContainer,
  publishInstagramMedia,
  publishFacebookPost,
} from "./meta-api";

/**
 * Gate E0b — política de salida hacia la Graph API de Meta.
 *
 * Lo que se protege va más allá de "lanza al bloquear": la frontera `metaFetch`
 * recibe una fábrica diferida, así que un bloqueo debe impedir además que se
 * **construyan** los parámetros con `client_secret`, tokens o el texto a
 * publicar. Eso se verifica espiando `URLSearchParams`.
 *
 * Cero red real: `fetch` está mockeado y se comprueba que reciba cero llamadas.
 */

const APP_DEV = "111111111111111";
const APP_PROD = "999999999999999";
const CUENTA_DEV = "222222222222222";
const CUENTA_PROD = "888888888888888";

const ENV_ORIGINAL = { ...process.env };

let fetchSpy: ReturnType<typeof vi.fn>;
/**
 * Cuántas veces se construyeron parámetros de petición. Se cuenta con una
 * subclase y no con un spy: sustituir el constructor por un mock rompería el
 * caso autorizado, donde `URLSearchParams` sí debe funcionar de verdad.
 */
let construccionesDeParametros = 0;
const URLSearchParamsOriginal = globalThis.URLSearchParams;

function limpiar() {
  for (const clave of Object.keys(process.env)) {
    if (clave.startsWith("EGRESS_") || clave.startsWith("META_")) delete process.env[clave];
  }
}

beforeEach(() => {
  limpiar();
  vi.stubEnv("NODE_ENV", "test");
  process.env.META_APP_ID = APP_DEV;
  process.env.META_APP_SECRET = "secreto-sintetico-de-prueba";

  fetchSpy = vi.fn(async () => new Response(JSON.stringify({ id: "x" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchSpy);

  // Si la fábrica diferida se ejecutara, tendría que construir aquí los
  // parámetros sensibles. Contar las construcciones prueba que no ocurrió.
  construccionesDeParametros = 0;
  vi.stubGlobal(
    "URLSearchParams",
    class extends URLSearchParamsOriginal {
      constructor(...args: ConstructorParameters<typeof URLSearchParamsOriginal>) {
        construccionesDeParametros += 1;
        super(...args);
      }
    }
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const clave of Object.keys(process.env)) {
    if (!(clave in ENV_ORIGINAL)) delete process.env[clave];
  }
  Object.assign(process.env, ENV_ORIGINAL);
  vi.restoreAllMocks();
});

/** Habilita el canal en modo allowlist con la app y la cuenta sintéticas. */
function permitir(extra: Record<string, string> = {}) {
  process.env.EGRESS_META_MODE = "allowlist";
  process.env.EGRESS_META_APP_ALLOWLIST = APP_DEV;
  process.env.EGRESS_META_ACCOUNT_ALLOWLIST = CUENTA_DEV;
  Object.assign(process.env, extra);
}

const pedir = (operation: MetaOperation, kind: "app" | "account" = "app", id = APP_DEV) =>
  assertMetaEgressAllowed({ operation, target: { kind, id } });

// ── Política ──────────────────────────────────────────────────────────────────

describe("meta — política", () => {
  it("sin variables bloquea", () => {
    expect(() => pedir("read")).toThrow(EgressBlockedError);
  });

  it("modo vacío bloquea", () => {
    process.env.EGRESS_META_MODE = "";
    expect(() => pedir("read")).toThrow(/mode_invalid/);
  });

  it("modo desconocido bloquea", () => {
    process.env.EGRESS_META_MODE = "enabled";
    expect(() => pedir("read")).toThrow(/mode_invalid/);
  });

  it("habilitar meta no habilita otros canales", async () => {
    permitir();
    expect(() => pedir("read")).not.toThrow();
    const { assertEgressAllowed } = await import("@/lib/egress-guard");
    expect(() => assertEgressAllowed({ channel: "email", operation: "send" })).toThrow(
      /mode_disabled/
    );
  });

  it("app allowlisted exacta pasa", () => {
    permitir();
    expect(() => pedir("read", "app", APP_DEV)).not.toThrow();
  });

  it("cuenta allowlisted exacta pasa", () => {
    permitir();
    expect(() => pedir("read", "account", CUENTA_DEV)).not.toThrow();
  });

  it("app no allowlisted bloquea", () => {
    permitir();
    expect(() => pedir("read", "app", "123")).toThrow(/target_not_allowed/);
  });

  it("cuenta no allowlisted bloquea", () => {
    permitir();
    expect(() => pedir("read", "account", "123")).toThrow(/target_not_allowed/);
  });

  it("coincidencia parcial bloquea", () => {
    permitir();
    expect(() => pedir("read", "app", APP_DEV.slice(0, -1))).toThrow(/target_not_allowed/);
    expect(() => pedir("read", "app", APP_DEV + "0")).toThrow(/target_not_allowed/);
  });

  it("una cuenta no se autoriza con la allowlist de apps", () => {
    permitir();
    // El mismo identificador como cuenta no debe pasar por estar en apps.
    expect(() => pedir("read", "account", APP_DEV)).toThrow(/target_not_allowed/);
  });

  it("target ausente bloquea", () => {
    permitir();
    expect(() => pedir("read", "app", "  ")).toThrow(/target_missing/);
  });

  it("ID de app productivo bloquea fuera de producción aunque esté allowlisted", () => {
    permitir();
    process.env.EGRESS_META_APP_ALLOWLIST = `${APP_DEV},${APP_PROD}`;
    process.env.EGRESS_META_PRODUCTION_APP_IDS = APP_PROD;
    expect(() => pedir("read", "app", APP_PROD)).toThrow(
      /production_target_from_non_production/
    );
  });

  it("cuenta productiva bloquea fuera de producción aunque esté allowlisted", () => {
    permitir();
    process.env.EGRESS_META_ACCOUNT_ALLOWLIST = `${CUENTA_DEV},${CUENTA_PROD}`;
    process.env.EGRESS_META_PRODUCTION_ACCOUNT_IDS = CUENTA_PROD;
    expect(() => pedir("read", "account", CUENTA_PROD)).toThrow(
      /production_target_from_non_production/
    );
  });

  it("live fuera de producción exige reconocimiento general exacto", () => {
    process.env.EGRESS_META_MODE = "live";
    expect(() => pedir("read")).toThrow(/live_outside_production/);
    process.env.EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION = "true";
    expect(() => pedir("read")).not.toThrow();
  });
});

// ── Credenciales ──────────────────────────────────────────────────────────────

describe("meta — operaciones con credenciales", () => {
  it("token_exchange sin reconocimiento bloquea", () => {
    permitir();
    expect(() => pedir("token_exchange")).toThrow(/credential_read_not_authorized/);
  });

  it("credential_read sin reconocimiento bloquea", () => {
    permitir();
    expect(() => pedir("credential_read")).toThrow(/credential_read_not_authorized/);
  });

  it("true exacto permite", () => {
    permitir({ EGRESS_META_ALLOW_CREDENTIAL_READ: "true" });
    expect(() => pedir("token_exchange")).not.toThrow();
    expect(() => pedir("credential_read")).not.toThrow();
  });

  it.each(["1", "yes", "enabled"])("el valor %o no autoriza", (valor) => {
    permitir({ EGRESS_META_ALLOW_CREDENTIAL_READ: valor });
    expect(() => pedir("credential_read")).toThrow(/credential_read_not_authorized/);
  });

  it("el reconocimiento de credenciales no habilita publicación", () => {
    permitir({ EGRESS_META_ALLOW_CREDENTIAL_READ: "true" });
    expect(() => pedir("publish", "account", CUENTA_DEV)).toThrow(/publish_not_authorized/);
  });
});

// ── Publicación ───────────────────────────────────────────────────────────────

describe("meta — publicación", () => {
  it("create_media sin reconocimiento bloquea", () => {
    permitir();
    expect(() => pedir("create_media", "account", CUENTA_DEV)).toThrow(/publish_not_authorized/);
  });

  it("publish sin reconocimiento bloquea", () => {
    permitir();
    expect(() => pedir("publish", "account", CUENTA_DEV)).toThrow(/publish_not_authorized/);
  });

  it("true exacto permite ambas", () => {
    permitir({ EGRESS_META_ALLOW_PUBLISH: "true" });
    expect(() => pedir("create_media", "account", CUENTA_DEV)).not.toThrow();
    expect(() => pedir("publish", "account", CUENTA_DEV)).not.toThrow();
  });

  it.each(["1", "yes", "enabled", "TRUE-ish"])("el valor %o no autoriza publicar", (valor) => {
    permitir({ EGRESS_META_ALLOW_PUBLISH: valor });
    expect(() => pedir("publish", "account", CUENTA_DEV)).toThrow(/publish_not_authorized/);
  });

  it("el reconocimiento de publicación no habilita lectura de credenciales", () => {
    permitir({ EGRESS_META_ALLOW_PUBLISH: "true" });
    expect(() => pedir("credential_read")).toThrow(/credential_read_not_authorized/);
  });
});

// ── Frontera: cero red y cero construcción de secretos ────────────────────────

describe("meta — frontera metaFetch", () => {
  it("OAuth bloqueado: cero fetch y cero parámetros construidos", async () => {
    await expect(exchangeCodeForToken("codigo-oauth", "https://ejemplo.local/cb")).rejects.toThrow(
      /EGRESS_BLOCKED/
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(construccionesDeParametros).toBe(0);
  });

  it("credential_read bloqueado: cero fetch", async () => {
    await expect(getFacebookPages("token-usuario")).rejects.toThrow(/EGRESS_BLOCKED/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lectura bloqueada: cero fetch", async () => {
    await expect(getFacebookUser("token")).rejects.toThrow(/EGRESS_BLOCKED/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("create_media bloqueado: cero fetch y cero parámetros con caption", async () => {
    await expect(
      createInstagramMediaContainer(CUENTA_DEV, "token", "texto secreto", "https://img.local/a.jpg")
    ).rejects.toThrow(/EGRESS_BLOCKED/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(construccionesDeParametros).toBe(0);
  });

  it("Instagram publish bloqueado: cero fetch", async () => {
    await expect(publishInstagramMedia(CUENTA_DEV, "token", "creation")).rejects.toThrow(
      /EGRESS_BLOCKED/
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Facebook foto bloqueado: cero fetch", async () => {
    await expect(
      publishFacebookPost(CUENTA_DEV, "token", "mensaje", "https://img.local/a.jpg")
    ).rejects.toThrow(/EGRESS_BLOCKED/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Facebook feed bloqueado: cero fetch", async () => {
    await expect(publishFacebookPost(CUENTA_DEV, "token", "mensaje")).rejects.toThrow(
      /EGRESS_BLOCKED/
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("autorizado: la fábrica sí corre y el fetch llega al BASE de Meta", async () => {
    permitir({ EGRESS_META_ALLOW_PUBLISH: "true" });
    await publishFacebookPost(CUENTA_DEV, "token", "mensaje");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url.startsWith("https://graph.facebook.com/")).toBe(true);
    expect(url).toContain(`/${CUENTA_DEV}/feed`);
  });
});

// ── Higiene de errores ────────────────────────────────────────────────────────

describe("meta — errores sanitizados", () => {
  it("un fallo HTTP no filtra cuerpo, tokens ni secretos", async () => {
    permitir({ EGRESS_META_ALLOW_CREDENTIAL_READ: "true" });
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "abc-secreto", code: 190 } }), {
        status: 400,
      })
    );

    try {
      await exchangeCodeForToken("codigo-oauth-xyz", "https://ejemplo.local/cb");
      throw new Error("debió lanzar");
    } catch (err) {
      const mensaje = (err as Error).message;
      expect(mensaje).toContain("META_API_ERROR: token_exchange failed with HTTP 400");
      expect(mensaje).not.toContain("abc-secreto");
      expect(mensaje).not.toContain("codigo-oauth-xyz");
      expect(mensaje).not.toContain("secreto-sintetico-de-prueba");
      expect(mensaje).not.toContain("graph.facebook.com");
      expect(mensaje).not.toContain("access_token");
    }
  });

  it("getInstagramUsername conserva su contrato: cadena vacía, no excepción", async () => {
    permitir();
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 404 }));
    await expect(getInstagramUsername(CUENTA_DEV, "token")).resolves.toBe("");
  });

  it("debugToken conserva su contrato: is_valid false, no excepción", async () => {
    permitir();
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 400 }));
    await expect(debugToken("token")).resolves.toEqual({ is_valid: false });
  });
});
