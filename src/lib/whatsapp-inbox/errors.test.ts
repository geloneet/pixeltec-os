import { describe, expect, test } from "vitest";
import { SafeUserError } from "@/lib/ai/errors";
import { EgressBlockedError } from "@/lib/egress-guard";
import { PixelbotError, parseJsonBody, toInboxFailure } from "./errors";

/**
 * Contrato de errores del subsistema.
 *
 * Lo que se prueba no es que el mensaje sea bonito, sino que sea **nuestro**:
 * todo texto que venga de un tercero —FastAPI, undici, Drizzle— se descarta sin
 * inspeccionarlo.
 */

const MENSAJE_PROPIO = "No se pudo completar la operación.";

/** Fragmentos que jamás pueden aparecer en una respuesta saneada. */
const NUNCA = [
  "http://pixelbot:3011",
  "pixelbot:3011",
  "127.0.0.1",
  "s3cr3t-interno-de-32-chars-largo",
  "+5213221234567",
  "hola, este es el mensaje real",
  "tenant-abc-123",
  "SELECT",
  "Traceback",
  "/app/agent/main.py",
];

function serializar(failure: { code: string; message: string; status: number }): string {
  return `${failure.code} ${failure.message} ${failure.status}`;
}

describe("toInboxFailure — descarta el texto ajeno", () => {
  test("un Error desconocido no aporta su message", () => {
    const err = new Error(
      'Traceback (most recent call last): File "/app/agent/main.py" ... ' +
        "SELECT * FROM mensajes WHERE telefono = '+5213221234567' ... " +
        "X-Internal-Secret: s3cr3t-interno-de-32-chars-largo"
    );
    const failure = toInboxFailure(err, MENSAJE_PROPIO);

    expect(failure).toEqual({ code: "internal_error", message: MENSAJE_PROPIO, status: 500 });
    for (const fragmento of NUNCA) {
      expect(serializar(failure)).not.toContain(fragmento);
    }
  });

  test("un error de Drizzle con SQL, columnas y constraint no filtra nada", () => {
    const err = new Error(
      'duplicate key value violates unique constraint "whatsapp_contacts_phone_key" ' +
        "DETAIL: Key (phone)=(+5213221234567) already exists."
    );
    const failure = toInboxFailure(err, MENSAJE_PROPIO);

    expect(failure.code).toBe("internal_error");
    expect(failure.message).toBe(MENSAJE_PROPIO);
    expect(serializar(failure)).not.toContain("+5213221234567");
    expect(serializar(failure)).not.toContain("whatsapp_contacts_phone_key");
  });

  test.each([
    ["string suelto", "algo con el secreto s3cr3t-interno-de-32-chars-largo"],
    ["objeto plano", { url: "http://pixelbot:3011", secret: "s3cr3t-interno-de-32-chars-largo" }],
    ["null", null],
    ["undefined", undefined],
    ["número", 42],
  ])("valor lanzado no-Error (%s) sale como internal_error", (_caso, valor) => {
    const failure = toInboxFailure(valor, MENSAJE_PROPIO);
    expect(failure).toEqual({ code: "internal_error", message: MENSAJE_PROPIO, status: 500 });
  });

  test("el mensaje de salida es literalmente el que le pasamos", () => {
    const failure = toInboxFailure(new Error("cualquier cosa"), "No se pudo enviar el mensaje.");
    expect(failure.message).toBe("No se pudo enviar el mensaje.");
  });
});

describe("toInboxFailure — mapeo de status", () => {
  test("upstream 4xx conserva el status y un código seguro", () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429]) {
      const failure = toInboxFailure(
        new PixelbotError({ code: "pixelbot_upstream", status }),
        MENSAJE_PROPIO
      );
      expect(failure).toEqual({ code: "pixelbot_upstream", message: MENSAJE_PROPIO, status });
    }
  });

  test("upstream 5xx se traduce a 502: el fallo es del tercero, no de esta API", () => {
    for (const status of [500, 502, 503, 504]) {
      const failure = toInboxFailure(
        new PixelbotError({ code: "pixelbot_upstream", status }),
        MENSAJE_PROPIO
      );
      expect(failure.status).toBe(502);
      expect(failure.code).toBe("pixelbot_upstream");
    }
  });

  test("upstream sin status cae a 502", () => {
    const failure = toInboxFailure(new PixelbotError({ code: "pixelbot_upstream" }), MENSAJE_PROPIO);
    expect(failure.status).toBe(502);
  });

  test.each([
    ["pixelbot_timeout", 504],
    ["pixelbot_unreachable", 502],
    ["pixelbot_redirect_blocked", 502],
    ["pixelbot_invalid_response", 502],
    ["pixelbot_not_configured", 503],
    ["pixelbot_path_rejected", 500],
  ] as const)("%s → %i con código estable", (code, status) => {
    const failure = toInboxFailure(new PixelbotError({ code }), MENSAJE_PROPIO);
    expect(failure).toEqual({ code, message: MENSAJE_PROPIO, status });
  });

  test("egress bloqueado se distingue del fallo de servicio y sale 503", () => {
    const err = new EgressBlockedError({
      channel: "internal",
      operation: "send_message",
      reason: "send_not_authorized",
    });
    const failure = toInboxFailure(err, MENSAJE_PROPIO);
    expect(failure).toEqual({ code: "egress_blocked", message: MENSAJE_PROPIO, status: 503 });
  });

  test("SafeUserError sí conserva su texto: lo redactamos nosotros", () => {
    const failure = toInboxFailure(
      new SafeUserError("Créditos insuficientes", "no_credits"),
      MENSAJE_PROPIO
    );
    expect(failure).toEqual({
      code: "no_credits",
      message: "Créditos insuficientes",
      status: 400,
    });
  });
});

describe("PixelbotError", () => {
  test("instanceof funciona pese a extender Error", () => {
    const err = new PixelbotError({ code: "pixelbot_timeout" });
    expect(err).toBeInstanceOf(PixelbotError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PixelbotError");
  });

  test("el mensaje solo cita el código y, si lo hay, el status numérico", () => {
    expect(new PixelbotError({ code: "pixelbot_upstream", status: 503 }).message).toBe(
      "PIXELBOT_ERROR: pixelbot_upstream (status 503)"
    );
    expect(new PixelbotError({ code: "pixelbot_timeout" }).message).toBe(
      "PIXELBOT_ERROR: pixelbot_timeout"
    );
  });

  test("no transporta url, host, cuerpo ni respuesta cruda", () => {
    const err = new PixelbotError({ code: "pixelbot_upstream", status: 500 });

    // Las únicas propiedades propias son el código, el status numérico y el
    // nombre de la clase. Ninguna puede transportar texto de un tercero.
    expect(Object.keys(err).sort()).toEqual(["code", "name", "status"]);
    expect(err.name).toBe("PixelbotError");
    expect(typeof err.status).toBe("number");

    for (const fragmento of NUNCA) {
      expect(err.message).not.toContain(fragmento);
      expect(JSON.stringify(err)).not.toContain(fragmento);
    }
  });
});

describe("parseJsonBody", () => {
  test("devuelve el valor cuando el cuerpo es JSON válido", async () => {
    const req = { json: async () => ({ hola: "mundo" }) };
    await expect(parseJsonBody<{ hola: string }>(req)).resolves.toEqual({
      ok: true,
      value: { hola: "mundo" },
    });
  });

  test("un cuerpo malformado devuelve ok:false sin propagar el SyntaxError", async () => {
    // El SyntaxError de V8 incluye un fragmento del propio cuerpo enviado.
    const req = {
      json: async () => {
        throw new SyntaxError(
          `Unexpected token 'x', "{\\"phone\\":\\"+5213221234567\\"x" is not valid JSON`
        );
      },
    };
    const resultado = await parseJsonBody(req);

    expect(resultado).toEqual({ ok: false });
    expect(JSON.stringify(resultado)).not.toContain("+5213221234567");
  });
});
