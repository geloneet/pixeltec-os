import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AiProviderError } from "./ai/errors";
import { sendWhatsApp } from "./whatsapp/sender";

/**
 * Capa de transporte de las cuatro fronteras externas (E0f-1).
 *
 * La política ya decide *si* se puede salir. Esto prueba lo otro: que una vez
 * en el cable, un `Location` del otro extremo no consiga que la credencial —o
 * el cuerpo del cliente— acaben en un host que no elegimos nosotros.
 *
 * Los cinco status con significado de redirect se prueban uno a uno porque el
 * modo `manual` los devuelve como respuesta normal: si alguien quitara el
 * chequeo, un 303 pasaría por «respuesta rara» en vez de por fallo.
 */

const REDIRECTS = [301, 302, 303, 307, 308] as const;

/** Fragmentos que jamás pueden aparecer en un error de transporte. */
const NUNCA = [
  "evil.example.com",
  "tok3n-de-whatsapp",
  "+5213221234567",
  "hola, este es el mensaje real",
  "Traceback",
];

let fetchMock: ReturnType<typeof vi.fn>;

const ENV = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_DEFAULT_TO",
  "META_APP_ID",
  "META_APP_SECRET",
  "EGRESS_DEFAULT_MODE",
  "EGRESS_AI_MODE",
  "EGRESS_AI_TARGET_ALLOWLIST",
  "EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION",
  "EGRESS_WHATSAPP_MODE",
  "EGRESS_WHATSAPP_ALLOWLIST",
  "EGRESS_META_MODE",
  "EGRESS_META_APP_ALLOWLIST",
  "EGRESS_META_ACCOUNT_ALLOWLIST",
] as const;
const original: Record<string, string | undefined> = {};

/**
 * Respuesta de redirect que grita si alguien la inspecciona: leer el cuerpo o
 * pedir una cabecera marca el spy, y eso hace fallar el test.
 */
function redirectEspia(status: number) {
  const jsonSpy = vi.fn(async () => ({ secreto: "no deberías leer esto" }));
  const textSpy = vi.fn(async () => "no deberías leer esto");
  const headerSpy = vi.fn(() => "https://evil.example.com/robo");
  return {
    res: {
      status,
      ok: false,
      type: "default",
      headers: { get: headerSpy },
      json: jsonSpy,
      text: textSpy,
    } as unknown as Response,
    jsonSpy,
    textSpy,
    headerSpy,
  };
}

function respuestaOk(json: unknown = { ok: true }) {
  return {
    status: 200,
    ok: true,
    type: "default",
    headers: { get: () => "application/json" },
    json: async () => json,
    text: async () => JSON.stringify(json),
  } as unknown as Response;
}

/** Todo autorizado en las cuatro políticas. */
function configurarPermisivo() {
  process.env.IDEOGRAM_API_KEY = "ap1-key-de-ideogram";
  process.env.WHATSAPP_ACCESS_TOKEN = "tok3n-de-whatsapp";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "111222333";
  process.env.META_APP_ID = "app-1";
  process.env.META_APP_SECRET = "meta-secreto";

  process.env.EGRESS_AI_MODE = "allowlist";
  process.env.EGRESS_AI_TARGET_ALLOWLIST = "ideogram:v_2";
  process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
  process.env.EGRESS_WHATSAPP_MODE = "allowlist";
  process.env.EGRESS_WHATSAPP_ALLOWLIST = "+5213221234567";
  process.env.EGRESS_META_MODE = "allowlist";
  process.env.EGRESS_META_APP_ALLOWLIST = "app-1";
}

async function capturar(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error("se esperaba un fallo y la llamada tuvo éxito");
}

function sinFugas(err: unknown) {
  const serializado = `${(err as Error)?.message ?? ""} ${JSON.stringify(err)}`;
  for (const fragmento of NUNCA) {
    expect(serializado).not.toContain(fragmento);
  }
}

beforeEach(() => {
  for (const clave of ENV) {
    original[clave] = process.env[clave];
    delete process.env[clave];
  }
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  configurarPermisivo();
});

afterEach(() => {
  for (const clave of ENV) {
    if (original[clave] === undefined) delete process.env[clave];
    else process.env[clave] = original[clave];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Ideogram ─────────────────────────────────────────────────────────────────

// ── WhatsApp ─────────────────────────────────────────────────────────────────

describe("WhatsApp — redirects", () => {
  test.each(REDIRECTS)("%i se bloquea sin seguirlo", async (status) => {
    const { res, jsonSpy, headerSpy } = redirectEspia(status);
    fetchMock.mockResolvedValueOnce(res);

    const err = await capturar(() =>
      sendWhatsApp("hola, este es el mensaje real", { to: "+5213221234567" })
    );

    expect((err as Error).message).toContain("redirect blocked");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(headerSpy).not.toHaveBeenCalled();
    sinFugas(err);
  });

  test("la petición sale con redirect: manual", async () => {
    fetchMock.mockResolvedValueOnce(respuestaOk({ messages: [{ id: "wamid.1" }] }));
    await sendWhatsApp("hola", { to: "+5213221234567" });
    expect(fetchMock.mock.calls[0][1].redirect).toBe("manual");
  });

  test("un fallo de red no propaga el mensaje de undici", async () => {
    const fallo = new TypeError("fetch failed");
    (fallo as Error & { cause?: unknown }).cause = new Error("ECONNREFUSED evil.example.com:443");
    fetchMock.mockRejectedValueOnce(fallo);

    const err = await capturar(() => sendWhatsApp("hola", { to: "+5213221234567" }));
    expect((err as Error).message).toBe("Meta WhatsApp API network error");
    sinFugas(err);
  });

  test("un error de Meta no incluye su texto libre, que puede citar el mensaje", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 400,
      ok: false,
      type: "default",
      headers: { get: () => null },
      json: async () => ({
        error: {
          message: "Invalid parameter: hola, este es el mensaje real",
          code: 100,
          error_subcode: 2018001,
          fbtrace_id: "Abc123",
        },
      }),
    } as unknown as Response);

    const err = await capturar(() =>
      sendWhatsApp("hola, este es el mensaje real", { to: "+5213221234567" })
    );

    // Los códigos numéricos y el fbtrace sí sobreviven: son opacos y útiles.
    expect((err as Error).message).toContain("code=100");
    expect((err as Error).message).toContain("subcode=2018001");
    expect((err as Error).message).toContain("fbtrace=Abc123");
    sinFugas(err);
  });
});

// ── Meta Graph ───────────────────────────────────────────────────────────────

// El bloque "Meta Graph — redirects" (getFacebookUser, lib/growth/social/
// meta-api.ts) se retiró junto con el Growth Suite (WO-2026-00132).

// ── VPS ──────────────────────────────────────────────────────────────────────

