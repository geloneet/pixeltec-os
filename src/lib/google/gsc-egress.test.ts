import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

/**
 * Puerta hacia Search Console: fail-closed por política, error explícito de
 * configuración, y NUNCA se propaga el cuerpo crudo de la respuesta de Google.
 *
 * `fetch` va mockeado siempre: jamás se llama a Google de verdad desde un test.
 */

const { authorizeMock } = vi.hoisted(() => ({
  authorizeMock: vi.fn(async () => ({ access_token: "token-de-prueba" })),
}));

vi.mock("google-auth-library", () => ({
  JWT: class {
    constructor(_opts: unknown) {}
    authorize = authorizeMock;
  },
}));

import { querySearchAnalytics, isGscConfigured, GSC_ROW_LIMIT } from "./gsc-egress";
import { EgressBlockedError } from "@/lib/egress-guard";

/** JSON de cuenta de servicio sintético — no es una credencial real. */
const CUENTA_SINTETICA = Buffer.from(
  JSON.stringify({ client_email: "robot@ejemplo.iam.gserviceaccount.com", private_key: "-----CLAVE-FALSA-----" })
).toString("base64");

const ORIGINAL_ENV = { ...process.env };
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.EGRESS_GOOGLE_MODE = "live";
  process.env.EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION = "true";
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = CUENTA_SINTETICA;
  authorizeMock.mockResolvedValue({ access_token: "token-de-prueba" });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

function okResponse(rows: unknown[]) {
  return { ok: true, status: 200, json: async () => ({ rows }) };
}

const query = {
  siteUrl: "sc-domain:pixeltec.mx",
  startDate: "2026-08-01",
  endDate: "2026-08-28",
  dimensions: ["page"] as const,
};

describe("política de egress", () => {
  test("sin EGRESS_GOOGLE_MODE el guard bloquea ANTES de tocar la red", async () => {
    delete process.env.EGRESS_GOOGLE_MODE;
    await expect(querySearchAnalytics({ ...query, dimensions: ["page"] })).rejects.toBeInstanceOf(
      EgressBlockedError
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(authorizeMock).not.toHaveBeenCalled();
  });

  test("modo live fuera de producción sin el flag global → bloqueado", async () => {
    delete process.env.EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION;
    await expect(querySearchAnalytics({ ...query, dimensions: ["page"] })).rejects.toMatchObject({
      code: "EGRESS_BLOCKED",
      reason: "live_outside_production",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("configuración", () => {
  test("sin credencial → gsc_not_configured, sin llamar a la red", async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    await expect(querySearchAnalytics({ ...query, dimensions: ["page"] })).rejects.toThrow(
      "gsc_not_configured"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("credencial que no es base64 de un JSON válido → gsc_credentials_invalid", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "esto-no-es-base64-de-un-json";
    await expect(querySearchAnalytics({ ...query, dimensions: ["page"] })).rejects.toThrow(
      "gsc_credentials_invalid"
    );
  });

  test("JSON sin client_email/private_key → gsc_credentials_invalid", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = Buffer.from(JSON.stringify({ tipo: "otro" })).toString("base64");
    await expect(querySearchAnalytics({ ...query, dimensions: ["page"] })).rejects.toThrow(
      "gsc_credentials_invalid"
    );
  });

  test("siteUrl vacío → gsc_not_configured", async () => {
    await expect(querySearchAnalytics({ ...query, siteUrl: "  ", dimensions: ["page"] })).rejects.toThrow(
      "gsc_not_configured"
    );
  });

  test("isGscConfigured refleja la presencia de la credencial, sin usarla", () => {
    expect(isGscConfigured()).toBe(true);
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    expect(isGscConfigured()).toBe(false);
  });
});

describe("querySearchAnalytics", () => {
  test("envía el cuerpo esperado al host fijo y normaliza las filas", async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse([{ keys: ["/blog/uno"], clicks: 10, impressions: 300, ctr: 0.033, position: 8.2 }])
    );

    const rows = await querySearchAnalytics({ ...query, dimensions: ["page", "query"], startRow: 25_000 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://searchconsole.googleapis.com/webmasters/v3/sites/");
    expect(String(url)).toContain(encodeURIComponent("sc-domain:pixeltec.mx"));

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      dimensions: ["page", "query"],
      rowLimit: GSC_ROW_LIMIT,
      startRow: 25_000,
      type: "web",
    });
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer token-de-prueba" });

    expect(rows).toEqual([
      { keys: ["/blog/uno"], clicks: 10, impressions: 300, ctr: 0.033, position: 8.2 },
    ]);
  });

  test("rowLimit se topa en el máximo de la API", async () => {
    fetchMock.mockResolvedValueOnce(okResponse([]));
    await querySearchAnalytics({ ...query, dimensions: ["page"], rowLimit: 999_999 });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.rowLimit).toBe(GSC_ROW_LIMIT);
  });

  test("respuesta sin `rows` → lista vacía, no un throw", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    await expect(querySearchAnalytics({ ...query, dimensions: ["page"] })).resolves.toEqual([]);
  });

  test("error HTTP → código estable SIN el cuerpo del proveedor", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: "robot@ejemplo.iam.gserviceaccount.com no tiene permiso" } }),
    });

    await expect(querySearchAnalytics({ ...query, dimensions: ["page"] })).rejects.toThrow(
      /^gsc_http_403$/
    );
  });
});
