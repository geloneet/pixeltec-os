import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Superficie del smoke-test de WhatsApp.
 *
 * `sendWhatsApp` ya redacta sus propios mensajes (E0b/E0c), pero este `catch`
 * atrapa además los `… is not configured` —que nombran variables de entorno— y
 * cualquier error no previsto. Ninguno debe salir en la respuesta.
 */

const { sendWhatsAppMock } = vi.hoisted(() => ({ sendWhatsAppMock: vi.fn() }));

vi.mock("@/lib/whatsapp/sender", () => ({ sendWhatsApp: sendWhatsAppMock }));
vi.mock("@/lib/cron-guard", () => ({
  assertCronExecutionAllowed: vi.fn(),
  cronBlockedResponse: vi.fn(() => null),
}));

import { POST } from "./route";

const CRON_SECRET = "secreto-de-prueba";
const RAW_SQL = "SELECT * FROM whatsapp_messages";

function makeRequest(body: unknown = {}, raw?: string) {
  return new NextRequest("http://localhost/api/whatsapp/send-test", {
    method: "POST",
    headers: { authorization: `Bearer ${CRON_SECRET}` },
    body: raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  sendWhatsAppMock.mockResolvedValue({ messageId: "wamid.TEST", to: "+5213221234567" });
});

describe("POST /api/whatsapp/send-test — el error no lleva texto interno", () => {
  test("una variable de entorno ausente no se nombra en la respuesta", async () => {
    sendWhatsAppMock.mockRejectedValueOnce(new Error("WHATSAPP_ACCESS_TOKEN is not configured"));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("No se pudo enviar el mensaje de prueba.");
    expect(body.code).toBe("whatsapp_send_test_failed");
    expect(JSON.stringify(body)).not.toContain("WHATSAPP_ACCESS_TOKEN");
  });

  test("el mensaje del SDK de Meta no se propaga", async () => {
    sendWhatsAppMock.mockRejectedValueOnce(
      new Error("Meta WhatsApp API failed (400) [code=131030, fbtrace=Axf9]")
    );

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("fbtrace");
    expect(JSON.stringify(body)).not.toContain("131030");
  });

  test("un error desconocido con SQL no filtra nada", async () => {
    sendWhatsAppMock.mockRejectedValueOnce(
      Object.assign(new Error(`fallo raro — ${RAW_SQL}`), { name: "PostgresError" })
    );

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("SELECT");
    expect(serialized).not.toContain("fallo raro");
  });

  test("un cuerpo JSON inválido no revela el offset del parser", async () => {
    // La ruta hace `request.json().catch(() => ({}))`, así que un cuerpo roto
    // cae al mensaje por defecto y llega a `sendWhatsApp`; lo que importa es
    // que ningún `SyntaxError` acabe en la respuesta.
    const res = await POST(makeRequest(undefined, "{ esto no es json"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("Unexpected token");
    expect(JSON.stringify(body)).not.toContain("position");
  });

  test("sin autorización responde 401 y no ejecuta el envío", async () => {
    const req = new NextRequest("http://localhost/api/whatsapp/send-test", {
      method: "POST",
      body: "{}",
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(sendWhatsAppMock).not.toHaveBeenCalled();
  });

  test("el contrato de éxito no cambia", async () => {
    const res = await POST(makeRequest({ message: "hola" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, messageId: "wamid.TEST", to: "+5213221234567" });
  });
});
