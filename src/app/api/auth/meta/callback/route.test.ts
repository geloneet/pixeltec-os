import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Superficie del callback de OAuth de Meta.
 *
 * Es el punto más expuesto de G-04 y el único que no responde con un cuerpo
 * JSON sino con un **redirect**: cualquier texto que se ponga en la URL acaba
 * en el historial del navegador, en los logs de acceso de nginx y en la
 * cabecera `Referer` hacia terceros. Lo que se prueba aquí es que la URL final
 * no lleva más que un código estable.
 */

const { getSessionUidMock, upsertSocialAccountMock } = vi.hoisted(() => ({
  getSessionUidMock: vi.fn(),
  upsertSocialAccountMock: vi.fn(),
}));

const metaApi = vi.hoisted(() => ({
  exchangeCodeForToken: vi.fn(),
  getLongLivedToken: vi.fn(),
  getFacebookUser: vi.fn(),
  getFacebookPages: vi.fn(),
  getInstagramUsername: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSessionUid: getSessionUidMock }));
vi.mock("@/lib/growth/social/meta-api", () => metaApi);
vi.mock("@/lib/growth/actions/social-accounts", () => ({
  upsertSocialAccount: upsertSocialAccountMock,
}));

import { GET } from "./route";
import { OAUTH_STATE_COOKIE } from "@/lib/growth/social/meta-oauth-state";

const APP_URL = "https://os.pixeltec.mx";
// El nonce se compara con `timingSafeEqual`, que exige longitudes iguales.
const STATE = "nonce-de-prueba-32-chars-xxxxxxxx";

/** Marcadores que jamás pueden aparecer en la URL de redirect. */
const RAW_SQL = "SELECT * FROM social_accounts";
const ENV_SECRET_NAME = "DATABASE_URL";
const TOKEN_PRIVADO = "EAAG-token-sintetico";

function makeRequest(params: Record<string, string>, withCookie = true) {
  const url = new URL(`${APP_URL}/api/auth/meta/callback`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const req = new NextRequest(url);
  if (withCookie) req.cookies.set(OAUTH_STATE_COOKIE, STATE);
  return req;
}

/** Los parámetros de la URL a la que redirige el handler. */
function redirectParams(res: Response): URLSearchParams {
  return new URL(res.headers.get("location") ?? "").searchParams;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  getSessionUidMock.mockResolvedValue("user-1");
  metaApi.exchangeCodeForToken.mockResolvedValue({ access_token: TOKEN_PRIVADO });
  metaApi.getLongLivedToken.mockResolvedValue({ access_token: TOKEN_PRIVADO });
  metaApi.getFacebookUser.mockResolvedValue({ id: "fb-1", name: "Cuenta de prueba" });
  metaApi.getFacebookPages.mockResolvedValue([]);
  upsertSocialAccountMock.mockResolvedValue(undefined);
});

describe("GET /api/auth/meta/callback — la URL de redirect no transporta texto ajeno", () => {
  test("un error desconocido sólo aporta el código estable", async () => {
    metaApi.exchangeCodeForToken.mockRejectedValueOnce(
      new Error(`fallo raro — ${RAW_SQL} — ${ENV_SECRET_NAME} is not set — ${TOKEN_PRIVADO}`)
    );

    const res = await GET(makeRequest({ code: "fake-code", state: STATE }));
    const params = redirectParams(res);

    expect(params.get("meta_error")).toBe("oauth_failed");
    // El parámetro que transportaba el message ya no se emite.
    expect(params.has("meta_desc")).toBe(false);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("fallo raro");
    expect(location).not.toContain("SELECT");
    expect(location).not.toContain(ENV_SECRET_NAME);
    expect(location).not.toContain(TOKEN_PRIVADO);
  });

  test("un fallo de la base de datos no cita SQL en la barra de direcciones", async () => {
    // `upsertSocialAccount` corre dentro del mismo `try`: éste es el camino por
    // el que un error de Drizzle acababa en la URL.
    metaApi.getFacebookPages.mockResolvedValueOnce([
      { id: "page-1", name: "Página", access_token: TOKEN_PRIVADO },
    ]);
    upsertSocialAccountMock.mockRejectedValueOnce(
      Object.assign(new Error(`null value violates not-null constraint`), {
        name: "PostgresError",
        query: RAW_SQL,
      })
    );

    const res = await GET(makeRequest({ code: "fake-code", state: STATE }));
    const location = res.headers.get("location") ?? "";

    expect(redirectParams(res).get("meta_error")).toBe("oauth_failed");
    expect(location).not.toContain("constraint");
    expect(location).not.toContain("SELECT");
  });

  test("un error tipado de Meta tampoco expone su texto", async () => {
    // `metaError` ya redacta el mensaje (E0b), pero incluso ese texto —que
    // nombra la operación y el status upstream— se queda en el servidor.
    metaApi.getLongLivedToken.mockRejectedValueOnce(
      new Error("META_API_ERROR: token_exchange failed with HTTP 400")
    );

    const res = await GET(makeRequest({ code: "fake-code", state: STATE }));
    const location = res.headers.get("location") ?? "";

    expect(redirectParams(res).get("meta_error")).toBe("oauth_failed");
    expect(location).not.toContain("META_API_ERROR");
    expect(location).not.toContain("token_exchange");
  });

  test("el `error_description` que envía Meta no se refleja", async () => {
    // Segundo punto de fuga del mismo archivo: `?error_description=` lo escribe
    // Meta y se copiaba tal cual a `meta_desc`.
    const res = await GET(
      makeRequest({
        error: "access_denied",
        error_description: `El usuario canceló — ${RAW_SQL} — ${TOKEN_PRIVADO}`,
      })
    );
    const params = redirectParams(res);

    // Un código OAuth2 de la lista cerrada sí sobrevive: es un identificador.
    expect(params.get("meta_error")).toBe("access_denied");
    expect(params.has("meta_desc")).toBe(false);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("cancel");
    expect(location).not.toContain("SELECT");
    expect(location).not.toContain(TOKEN_PRIVADO);
  });

  test("un `error` fuera de la lista cerrada de OAuth2 se degrada a oauth_failed", async () => {
    const res = await GET(
      makeRequest({ error: `inventado_por_meta ${RAW_SQL}`, error_description: "lo que sea" })
    );

    expect(redirectParams(res).get("meta_error")).toBe("oauth_failed");
    expect(res.headers.get("location") ?? "").not.toContain("SELECT");
  });

  test("el camino feliz conserva su contrato", async () => {
    metaApi.getFacebookPages.mockResolvedValueOnce([
      { id: "page-1", name: "Página", access_token: TOKEN_PRIVADO },
    ]);

    const res = await GET(makeRequest({ code: "fake-code", state: STATE }));
    const params = redirectParams(res);

    expect(params.get("meta_connected")).toBe("1");
    expect(params.has("meta_error")).toBe(false);
  });

  test("sin páginas de Facebook se conserva el código no_pages", async () => {
    // `getFacebookPages` vacío toma su propia rama, anterior al catch.
    const res = await GET(makeRequest({ code: "fake-code", state: STATE }));

    expect(redirectParams(res).get("meta_error")).toBe("no_pages");
  });

  test("sin sesión activa redirige con no_session, sin descripción", async () => {
    getSessionUidMock.mockResolvedValueOnce(null);

    const res = await GET(makeRequest({ code: "fake-code", state: STATE }));
    const params = redirectParams(res);

    expect(params.get("meta_error")).toBe("no_session");
    expect(params.has("meta_desc")).toBe(false);
  });

  test("un state CSRF inválido redirige con invalid_state", async () => {
    const req = makeRequest({ code: "fake-code", state: STATE }, false);
    req.cookies.set(OAUTH_STATE_COOKIE, "otro-nonce-de-32-chars-yyyyyyyyy");

    const res = await GET(req);

    expect(redirectParams(res).get("meta_error")).toBe("invalid_state");
  });
});
