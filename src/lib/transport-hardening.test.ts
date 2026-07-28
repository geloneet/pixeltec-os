import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AiProviderError } from "./ai/errors";
import { ideogramGenerateImage } from "./ai/image-egress";
import { getFacebookUser } from "./growth/social/meta-api";
import { fetchVpsApi, VpsTransportError } from "./vpsClient";
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
  "s3cr3t-de-vps-32-chars-largo",
  "tok3n-de-whatsapp",
  "ap1-key-de-ideogram",
  "+5213221234567",
  "hola, este es el mensaje real",
  "Traceback",
];

let fetchMock: ReturnType<typeof vi.fn>;

const ENV = [
  "IDEOGRAM_API_KEY",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_DEFAULT_TO",
  "META_APP_ID",
  "META_APP_SECRET",
  "VPS_API_URL",
  "VPS_API_SECRET",
  "EGRESS_DEFAULT_MODE",
  "EGRESS_AI_MODE",
  "EGRESS_AI_TARGET_ALLOWLIST",
  "EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION",
  "EGRESS_WHATSAPP_MODE",
  "EGRESS_WHATSAPP_ALLOWLIST",
  "EGRESS_META_MODE",
  "EGRESS_META_APP_ALLOWLIST",
  "EGRESS_META_ACCOUNT_ALLOWLIST",
  "EGRESS_VPS_MODE",
  "EGRESS_VPS_HOST_ALLOWLIST",
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
  // Host no productivo a propósito: `api.pixeltec.mx` está vetado fuera de
  // producción por `PRODUCTION_VPS_HOSTNAMES`, y ese veto no es lo que se
  // prueba aquí — lo cubre `egress-guard.test.ts`.
  process.env.VPS_API_URL = "https://vps.ejemplo.local";
  process.env.VPS_API_SECRET = "s3cr3t-de-vps-32-chars-largo";

  process.env.EGRESS_AI_MODE = "allowlist";
  process.env.EGRESS_AI_TARGET_ALLOWLIST = "ideogram:v_2";
  process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
  process.env.EGRESS_WHATSAPP_MODE = "allowlist";
  process.env.EGRESS_WHATSAPP_ALLOWLIST = "+5213221234567";
  process.env.EGRESS_META_MODE = "allowlist";
  process.env.EGRESS_META_APP_ALLOWLIST = "app-1";
  process.env.EGRESS_VPS_MODE = "allowlist";
  process.env.EGRESS_VPS_HOST_ALLOWLIST = "vps.ejemplo.local";
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

describe("Ideogram — redirects", () => {
  test.each(REDIRECTS)("%i se bloquea sin seguirlo", async (status) => {
    const { res, jsonSpy, textSpy, headerSpy } = redirectEspia(status);
    const fetchImpl = vi.fn(async () => res) as unknown as typeof fetch;

    const err = await capturar(() =>
      ideogramGenerateImage({ model: "V_2", buildBody: () => ({ prompt: "x" }), fetchImpl })
    );

    expect(err).toBeInstanceOf(AiProviderError);
    expect((err as AiProviderError).code).toBe("ai_redirect_blocked");
    expect((err as AiProviderError).status).toBe(status);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(textSpy).not.toHaveBeenCalled();
    expect(headerSpy).not.toHaveBeenCalled();
    sinFugas(err);
  });

  test("la petición sale con redirect: manual y con Api-Key", async () => {
    const fetchImpl = vi.fn(async () => respuestaOk({ data: [] })) as unknown as typeof fetch;
    await ideogramGenerateImage({ model: "V_2", buildBody: () => ({ prompt: "x" }), fetchImpl });

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.redirect).toBe("manual");
    expect(init.headers["Api-Key"]).toBe("ap1-key-de-ideogram");
  });

  test("un 2xx normal sigue funcionando", async () => {
    const fetchImpl = vi.fn(async () => respuestaOk({ data: ["img"] })) as unknown as typeof fetch;
    await expect(
      ideogramGenerateImage({ model: "V_2", buildBody: () => ({ prompt: "x" }), fetchImpl })
    ).resolves.toEqual({ data: ["img"] });
  });
});

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

describe("Meta Graph — redirects", () => {
  test.each(REDIRECTS)("%i se bloquea sin seguirlo", async (status) => {
    const { res, jsonSpy, headerSpy } = redirectEspia(status);
    fetchMock.mockResolvedValueOnce(res);

    const err = await capturar(() => getFacebookUser("tok3n-de-whatsapp"));

    expect((err as Error).message).toContain("META_API_ERROR");
    expect((err as Error).message).toContain(String(status));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(headerSpy).not.toHaveBeenCalled();
    sinFugas(err);
  });

  test("la petición sale con redirect: manual", async () => {
    fetchMock.mockResolvedValueOnce(respuestaOk({ id: "1", name: "x" }));
    await getFacebookUser("tok3n-de-whatsapp");
    expect(fetchMock.mock.calls[0][1].redirect).toBe("manual");
  });
});

// ── VPS ──────────────────────────────────────────────────────────────────────

describe("VPS — redirects", () => {
  test.each(REDIRECTS)("%i se bloquea sin seguirlo", async (status) => {
    const { res, jsonSpy, textSpy, headerSpy } = redirectEspia(status);
    fetchMock.mockResolvedValueOnce(res);

    const err = await capturar(() => fetchVpsApi("/deploy", { method: "POST" }));

    expect(err).toBeInstanceOf(VpsTransportError);
    expect((err as VpsTransportError).code).toBe("vps_redirect_blocked");
    expect((err as VpsTransportError).status).toBe(status);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(textSpy).not.toHaveBeenCalled();
    expect(headerSpy).not.toHaveBeenCalled();
    sinFugas(err);
  });

  test("la petición sale con redirect: manual", async () => {
    fetchMock.mockResolvedValueOnce(respuestaOk({ projects: [] }));
    await fetchVpsApi("/projects");
    expect(fetchMock.mock.calls[0][1].redirect).toBe("manual");
  });
});

describe("VPS — saneamiento de respuesta y errores", () => {
  test("un cuerpo no-JSON de un no-2xx ni se lee ni se devuelve", async () => {
    const textSpy = vi.fn(async () => "<html>Traceback /app/main.py</html>".repeat(40));
    fetchMock.mockResolvedValueOnce({
      status: 502,
      ok: false,
      type: "default",
      headers: { get: () => "text/html" },
      json: async () => ({}),
      text: textSpy,
    } as unknown as Response);

    const res = await fetchVpsApi("/status");

    expect(res).toEqual({ ok: false, status: 502, data: null });
    expect(textSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(res)).not.toContain("Traceback");
  });

  test("los 500 caracteres crudos ya no existen en ninguna forma", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 500,
      ok: false,
      type: "default",
      headers: { get: () => "text/plain" },
      json: async () => ({}),
      text: async () => "X".repeat(2000),
    } as unknown as Response);

    const res = await fetchVpsApi("/health");
    expect(JSON.stringify(res)).not.toContain("XXXXX");
    expect(res.data).toBeNull();
  });

  test("2xx con JSON conserva el contrato VpsResponse", async () => {
    fetchMock.mockResolvedValueOnce(respuestaOk({ projects: ["a"] }));
    await expect(fetchVpsApi("/projects")).resolves.toEqual({
      ok: true,
      status: 200,
      data: { projects: ["a"] },
    });
  });

  test("2xx que no es JSON se rechaza con código estable", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      type: "default",
      headers: { get: () => "text/html" },
      json: async () => ({}),
      text: async () => "<html/>",
    } as unknown as Response);

    const err = await capturar(() => fetchVpsApi("/status"));
    expect((err as VpsTransportError).code).toBe("vps_invalid_response");
  });

  test("timeout sale con código estable y sin path", async () => {
    const abort = new Error("This operation was aborted");
    abort.name = "AbortError";
    fetchMock.mockRejectedValueOnce(abort);

    const err = await capturar(() => fetchVpsApi("/deploy", { method: "POST" }));
    expect((err as VpsTransportError).code).toBe("vps_timeout");
    expect((err as Error).message).not.toContain("/deploy");
    sinFugas(err);
  });

  test("error de red sale con código estable, sin err.message ni host", async () => {
    const fallo = new TypeError("fetch failed");
    (fallo as Error & { cause?: unknown }).cause = new Error(
      "connect ECONNREFUSED evil.example.com:443"
    );
    fetchMock.mockRejectedValueOnce(fallo);

    const err = await capturar(() => fetchVpsApi("/deploy", { method: "POST" }));
    expect((err as VpsTransportError).code).toBe("vps_unreachable");
    expect((err as Error).message).toBe("VPS_TRANSPORT_ERROR: vps_unreachable");
    expect((err as Error).message).not.toContain("/deploy");
    sinFugas(err);
  });

  test("el secreto nunca aparece en un error, aunque viaje en la query", async () => {
    fetchMock.mockRejectedValueOnce(new Error("boom s3cr3t-de-vps-32-chars-largo"));
    const err = await capturar(() => fetchVpsApi("/deploy", { method: "POST" }));
    sinFugas(err);
  });

  test("VpsTransportError solo transporta código, nombre y status", () => {
    const err = new VpsTransportError("vps_timeout");
    // `status` existe como clave propia aunque valga undefined: se asigna
    // siempre en el constructor. Las tres son opacas o numéricas.
    expect(Object.keys(err).sort()).toEqual(["code", "name", "status"]);
    expect(err.status).toBeUndefined();
    expect(err).toBeInstanceOf(VpsTransportError);
    expect(err).toBeInstanceOf(Error);
  });
});
