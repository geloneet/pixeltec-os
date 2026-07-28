import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EgressBlockedError } from "@/lib/egress-guard";
import { PixelbotError } from "./errors";
import { fetchPixelbot } from "./pixelbot-client";

/**
 * Cliente real, con `fetch` mockeado.
 *
 * Lo que se prueba sobre todo no es el camino feliz sino el bloqueado: cuando
 * la política rechaza una llamada, nadie debe haber leído el secreto,
 * serializado el cuerpo ni tocado la red.
 */

const SECRETO = "s3cr3t-interno-de-32-chars-largo";
const URL_OK = "http://pixelbot:3011";

let fetchMock: ReturnType<typeof vi.fn>;
/** Cuántas veces se leyó `PIXELBOT_INTERNAL_SECRET` desde `process.env`. */
let lecturasDelSecreto = 0;
/** Cuántas veces se serializó el cuerpo: prueba de que la petición no se preparó. */
let serializacionesDelBody = 0;

const ENV = [
  "PIXELBOT_INTERNAL_URL",
  "PIXELBOT_INTERNAL_SECRET",
  "EGRESS_INTERNAL_MODE",
  "EGRESS_INTERNAL_TARGET_ALLOWLIST",
  "EGRESS_INTERNAL_ALLOW_SEND_OUTSIDE_PRODUCTION",
  "EGRESS_DEFAULT_MODE",
] as const;
const original: Record<string, string | undefined> = {};

/** Referencia al `process.env` real, para restaurarlo al terminar. */
const ENV_REAL = process.env;

/**
 * Cuenta las lecturas de `PIXELBOT_INTERNAL_SECRET`.
 *
 * `process.env` es un objeto especial de Node que no admite descriptores de
 * acceso, así que se sustituye por un Proxy sobre una copia plana. Conserva lo
 * que ya hubiera configurado y sigue admitiendo asignaciones posteriores.
 */
function espiarSecreto(valor: string | undefined) {
  const target: Record<string, string | undefined> = { ...process.env };
  if (valor === undefined) delete target.PIXELBOT_INTERNAL_SECRET;
  else target.PIXELBOT_INTERNAL_SECRET = valor;

  process.env = new Proxy(target, {
    get(t, prop) {
      if (prop === "PIXELBOT_INTERNAL_SECRET") lecturasDelSecreto += 1;
      return t[prop as string];
    },
    deleteProperty(t, prop) {
      delete t[prop as string];
      return true;
    },
  }) as unknown as NodeJS.ProcessEnv;

  // Se pone a cero después de construir el target: copiarlo ya cuenta como lectura.
  lecturasDelSecreto = 0;
}

/** Cuerpo que delata su propia serialización. */
function bodyEspia(): Record<string, unknown> {
  serializacionesDelBody = 0;
  return {
    phone: "+5213221234567",
    text: "hola, este es el mensaje real",
    toJSON() {
      serializacionesDelBody += 1;
      return { phone: "+5213221234567", text: "hola, este es el mensaje real" };
    },
  };
}

function respuesta(
  status: number,
  {
    json = {},
    contentType = "application/json",
  }: { json?: unknown; contentType?: string | null } = {}
): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    type: "default",
    headers: { get: (n: string) => (n.toLowerCase() === "content-type" ? contentType : null) },
    json: async () => json,
  } as unknown as Response;
}

/** Todo autorizado: los casos que prueban un solo desvío parten de aquí. */
function configurarPermisivo() {
  process.env.PIXELBOT_INTERNAL_URL = URL_OK;
  process.env.EGRESS_INTERNAL_MODE = "allowlist";
  process.env.EGRESS_INTERNAL_TARGET_ALLOWLIST = "pixelbot:pixelbot:3011,pixelbot:127.0.0.1:3011";
  espiarSecreto(SECRETO);
}

async function capturar(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error("se esperaba un fallo y la llamada tuvo éxito");
}

/** El contrato del bloqueo: ni red, ni secreto, ni cuerpo preparado. */
function esperarBloqueoTotal() {
  expect(fetchMock).not.toHaveBeenCalled();
  expect(lecturasDelSecreto).toBe(0);
  expect(serializacionesDelBody).toBe(0);
}

beforeEach(() => {
  for (const clave of ENV) {
    original[clave] = process.env[clave];
    delete process.env[clave];
  }
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  lecturasDelSecreto = 0;
  serializacionesDelBody = 0;
});

afterEach(() => {
  // Devuelve el `process.env` real antes de restaurar claves: durante el test
  // pudo quedar sustituido por el Proxy contador.
  process.env = ENV_REAL;
  for (const clave of ENV) {
    if (original[clave] === undefined) delete process.env[clave];
    else process.env[clave] = original[clave];
  }
  vi.unstubAllGlobals();
});

describe("bloqueo — cero red, cero lectura del secreto, cero cuerpo serializado", () => {
  test("URL ausente", async () => {
    espiarSecreto(SECRETO);
    process.env.EGRESS_INTERNAL_MODE = "allowlist";
    process.env.EGRESS_INTERNAL_TARGET_ALLOWLIST = "pixelbot:pixelbot:3011";

    const err = await capturar(() => fetchPixelbot("/internal/send", bodyEspia(), "POST"));
    expect((err as PixelbotError).code).toBe("pixelbot_not_configured");
    esperarBloqueoTotal();
  });

  test("path inválido: ni siquiera se consulta la política", async () => {
    configurarPermisivo();
    const err = await capturar(() => fetchPixelbot("/internal/../admin", bodyEspia(), "POST"));
    expect((err as PixelbotError).code).toBe("pixelbot_path_rejected");
    esperarBloqueoTotal();
  });

  test("path desconocido", async () => {
    configurarPermisivo();
    const err = await capturar(() => fetchPixelbot("/internal/broadcast", bodyEspia(), "POST"));
    expect((err as PixelbotError).code).toBe("pixelbot_path_rejected");
    esperarBloqueoTotal();
  });

  test("operación no autorizada para ese path: método incorrecto", async () => {
    configurarPermisivo();
    const err = await capturar(() => fetchPixelbot("/internal/send", bodyEspia(), "PUT"));
    expect((err as PixelbotError).code).toBe("pixelbot_path_rejected");
    esperarBloqueoTotal();
  });

  test("modo ausente", async () => {
    process.env.PIXELBOT_INTERNAL_URL = URL_OK;
    process.env.EGRESS_INTERNAL_TARGET_ALLOWLIST = "pixelbot:pixelbot:3011";
    espiarSecreto(SECRETO);

    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect(err).toBeInstanceOf(EgressBlockedError);
    esperarBloqueoTotal();
  });

  test("URL inválida", async () => {
    configurarPermisivo();
    process.env.PIXELBOT_INTERNAL_URL = "no-es-una-url";
    const err = await capturar(() => fetchPixelbot("/internal/send", bodyEspia(), "POST"));
    expect((err as EgressBlockedError).reason).toBe("target_invalid");
    esperarBloqueoTotal();
  });

  test("host público, aunque esté en la allowlist", async () => {
    configurarPermisivo();
    process.env.PIXELBOT_INTERNAL_URL = "http://evil.example.com:3011";
    process.env.EGRESS_INTERNAL_TARGET_ALLOWLIST = "pixelbot:evil.example.com:3011";

    const err = await capturar(() => fetchPixelbot("/internal/send", bodyEspia(), "POST"));
    expect((err as EgressBlockedError).reason).toBe("target_invalid");
    esperarBloqueoTotal();
  });

  test("IP pública, aunque esté en la allowlist", async () => {
    configurarPermisivo();
    process.env.PIXELBOT_INTERNAL_URL = "http://203.0.113.10:3011";
    process.env.EGRESS_INTERNAL_TARGET_ALLOWLIST = "pixelbot:203.0.113.10:3011";

    const err = await capturar(() => fetchPixelbot("/internal/send", bodyEspia(), "POST"));
    expect((err as EgressBlockedError).reason).toBe("target_invalid");
    esperarBloqueoTotal();
  });

  test("puerto incorrecto", async () => {
    configurarPermisivo();
    process.env.PIXELBOT_INTERNAL_URL = "http://pixelbot:9999";
    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect((err as EgressBlockedError).reason).toBe("target_not_allowed");
    esperarBloqueoTotal();
  });

  test("protocolo incorrecto", async () => {
    configurarPermisivo();
    process.env.PIXELBOT_INTERNAL_URL = "ftp://pixelbot:3011";
    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect((err as EgressBlockedError).reason).toBe("target_invalid");
    esperarBloqueoTotal();
  });

  test("credenciales embebidas en la URL", async () => {
    configurarPermisivo();
    process.env.PIXELBOT_INTERNAL_URL = "http://alguien:secreto@pixelbot:3011";
    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect((err as EgressBlockedError).reason).toBe("target_invalid");
    esperarBloqueoTotal();
  });

  test("send_message sin reconocimiento fuera de producción", async () => {
    configurarPermisivo();
    const err = await capturar(() => fetchPixelbot("/internal/send", bodyEspia(), "POST"));
    expect((err as EgressBlockedError).reason).toBe("send_not_authorized");
    esperarBloqueoTotal();
  });

  test("el error de un bloqueo no cita teléfono ni mensaje del cuerpo", async () => {
    configurarPermisivo();
    const err = await capturar(() => fetchPixelbot("/internal/send", bodyEspia(), "POST"));
    const serializado = `${(err as Error).message} ${JSON.stringify(err)}`;
    expect(serializado).not.toContain("+5213221234567");
    expect(serializado).not.toContain("hola, este es el mensaje real");
    expect(serializado).not.toContain(SECRETO);
  });
});

describe("secreto ausente — solo se detecta DESPUÉS de autorizar el destino", () => {
  test("destino autorizado y sin secreto: not_configured, sin tocar la red", async () => {
    process.env.PIXELBOT_INTERNAL_URL = URL_OK;
    process.env.EGRESS_INTERNAL_MODE = "allowlist";
    process.env.EGRESS_INTERNAL_TARGET_ALLOWLIST = "pixelbot:pixelbot:3011";
    espiarSecreto(undefined);

    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect((err as PixelbotError).code).toBe("pixelbot_not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
    // Aquí SÍ se leyó: el destino ya había pasado la política.
    expect(lecturasDelSecreto).toBeGreaterThan(0);
  });

  test("destino NO autorizado: el secreto ni se consulta", async () => {
    process.env.PIXELBOT_INTERNAL_URL = URL_OK;
    process.env.EGRESS_INTERNAL_MODE = "disabled";
    espiarSecreto(undefined);

    await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect(lecturasDelSecreto).toBe(0);
  });
});

describe("autorizado — la petición se construye correctamente", () => {
  test("host Docker: un solo fetch, con secreto, redirect manual y sin caché", async () => {
    configurarPermisivo();
    fetchMock.mockResolvedValueOnce(respuesta(200, { json: { ok: true } }));

    const resultado = await fetchPixelbot("/internal/config", undefined, "GET");

    expect(resultado).toEqual({ data: { ok: true }, status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe("http://pixelbot:3011/internal/config");
    expect(opciones.redirect).toBe("manual");
    expect(opciones.cache).toBe("no-store");
    expect(opciones.headers["X-Internal-Secret"]).toBe(SECRETO);
    // GET no lleva cuerpo ni Content-Type.
    expect(opciones.body).toBeUndefined();
    expect(opciones.headers["Content-Type"]).toBeUndefined();
  });

  test("loopback autorizado", async () => {
    configurarPermisivo();
    process.env.PIXELBOT_INTERNAL_URL = "http://127.0.0.1:3011";
    fetchMock.mockResolvedValueOnce(respuesta(200, { json: { ok: true } }));

    await fetchPixelbot("/internal/config", undefined, "GET");
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:3011/internal/config");
  });

  test("send_message con reconocimiento: sale y serializa el cuerpo una sola vez", async () => {
    configurarPermisivo();
    process.env.EGRESS_INTERNAL_ALLOW_SEND_OUTSIDE_PRODUCTION = "true";
    fetchMock.mockResolvedValueOnce(respuesta(200, { json: { status: "sent" } }));

    await fetchPixelbot("/internal/send", bodyEspia(), "POST");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(serializacionesDelBody).toBe(1);
    const [, opciones] = fetchMock.mock.calls[0];
    expect(opciones.headers["Content-Type"]).toBe("application/json");
    expect(opciones.headers["X-Internal-Secret"]).toBe(SECRETO);
  });

  test("el secreto se lee exactamente una vez por llamada autorizada", async () => {
    configurarPermisivo();
    fetchMock.mockResolvedValueOnce(respuesta(200, { json: {} }));

    await fetchPixelbot("/internal/config", undefined, "GET");
    expect(lecturasDelSecreto).toBe(1);
  });
});

describe("redirects — ninguno se sigue", () => {
  test.each([301, 302, 303, 307, 308])("%i → pixelbot_redirect_blocked", async (status) => {
    configurarPermisivo();
    fetchMock.mockResolvedValueOnce(respuesta(status, { contentType: null }));

    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));

    expect(err).toBeInstanceOf(PixelbotError);
    expect((err as PixelbotError).code).toBe("pixelbot_redirect_blocked");
    expect((err as PixelbotError).status).toBe(status);
    // Exactamente una petición: no se sigue el Location.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("no se lee el cuerpo ni la cabecera Location del redirect", async () => {
    configurarPermisivo();
    const jsonSpy = vi.fn();
    const headerSpy = vi.fn().mockReturnValue("http://evil.example.com/robo");
    fetchMock.mockResolvedValueOnce({
      status: 302,
      ok: false,
      type: "default",
      headers: { get: headerSpy },
      json: jsonSpy,
    } as unknown as Response);

    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));

    expect(jsonSpy).not.toHaveBeenCalled();
    expect(headerSpy).not.toHaveBeenCalled();
    expect(`${(err as Error).message} ${JSON.stringify(err)}`).not.toContain("evil.example.com");
  });

  test("opaqueredirect también se rechaza", async () => {
    configurarPermisivo();
    fetchMock.mockResolvedValueOnce({
      status: 0,
      ok: false,
      type: "opaqueredirect",
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response);

    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect((err as PixelbotError).code).toBe("pixelbot_redirect_blocked");
  });
});

describe("respuestas de error — el cuerpo del upstream nunca se lee", () => {
  test.each([400, 401, 403, 404, 422, 429, 500, 502, 503])(
    "status %i lanza pixelbot_upstream sin tocar json()",
    async (status) => {
      configurarPermisivo();
      const jsonSpy = vi.fn().mockResolvedValue({
        detail: 'Traceback ... File "/app/agent/main.py" ... SELECT * FROM mensajes',
      });
      fetchMock.mockResolvedValueOnce({
        status,
        ok: false,
        type: "default",
        headers: { get: () => "application/json" },
        json: jsonSpy,
      } as unknown as Response);

      const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));

      expect((err as PixelbotError).code).toBe("pixelbot_upstream");
      expect((err as PixelbotError).status).toBe(status);
      expect(jsonSpy).not.toHaveBeenCalled();
      expect((err as PixelbotError).message).not.toContain("Traceback");
      expect((err as PixelbotError).message).not.toContain("SELECT");
    }
  );

  test("respuesta 200 que no es JSON no se confunde con {}", async () => {
    configurarPermisivo();
    fetchMock.mockResolvedValueOnce(respuesta(200, { contentType: "text/html" }));

    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect((err as PixelbotError).code).toBe("pixelbot_invalid_response");
  });

  test("content-type ausente se trata como no-JSON", async () => {
    configurarPermisivo();
    fetchMock.mockResolvedValueOnce(respuesta(200, { contentType: null }));

    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect((err as PixelbotError).code).toBe("pixelbot_invalid_response");
  });

  test("JSON declarado pero malformado", async () => {
    configurarPermisivo();
    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      type: "default",
      headers: { get: () => "application/json" },
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON at position 0");
      },
    } as unknown as Response);

    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect((err as PixelbotError).code).toBe("pixelbot_invalid_response");
    expect((err as PixelbotError).message).not.toContain("Unexpected token");
  });
});

describe("fallos de red — no se propaga el error de undici", () => {
  test("timeout", async () => {
    configurarPermisivo();
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    fetchMock.mockRejectedValueOnce(timeout);

    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect((err as PixelbotError).code).toBe("pixelbot_timeout");
  });

  test("abort", async () => {
    configurarPermisivo();
    const abort = new Error("This operation was aborted");
    abort.name = "AbortError";
    fetchMock.mockRejectedValueOnce(abort);

    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect((err as PixelbotError).code).toBe("pixelbot_timeout");
  });

  test("conexión rechazada: el mensaje de undici con host y puerto no sobrevive", async () => {
    configurarPermisivo();
    const fallo = new TypeError("fetch failed");
    (fallo as Error & { cause?: unknown }).cause = new Error("connect ECONNREFUSED 127.0.0.1:3011");
    fetchMock.mockRejectedValueOnce(fallo);

    const err = await capturar(() => fetchPixelbot("/internal/config", undefined, "GET"));
    expect((err as PixelbotError).code).toBe("pixelbot_unreachable");
    expect((err as PixelbotError).message).not.toContain("3011");
    expect((err as PixelbotError).message).not.toContain("ECONNREFUSED");
  });
});
