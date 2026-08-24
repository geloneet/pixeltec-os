import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MetaWhatsAppError, sendWhatsApp, sendWhatsAppTemplate } from "./sender";

/**
 * sendWhatsAppTemplate — transporte con fetch STUBBEADO (cero envíos reales).
 * Verifica que el payload que sale hacia Meta es exactamente el de la
 * plantilla, que reutiliza env/egress/redirect:manual del texto libre, y que
 * los errores de Meta (131047) quedan tipados. El texto libre se prueba en
 * transport-hardening.test.ts; aquí solo se confirma que sigue intacto.
 */

const ENV = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_DEFAULT_TO",
  "WHATSAPP_API_VERSION",
  "EGRESS_WHATSAPP_MODE",
  "EGRESS_WHATSAPP_ALLOWLIST",
] as const;
const original: Record<string, string | undefined> = {};
let fetchMock: ReturnType<typeof vi.fn>;

function respuestaOk(json: unknown): Response {
  return {
    status: 200,
    ok: true,
    type: "default",
    headers: { get: () => "application/json" },
    json: async () => json,
  } as unknown as Response;
}

beforeEach(() => {
  for (const k of ENV) {
    original[k] = process.env[k];
    delete process.env[k];
  }
  process.env.WHATSAPP_ACCESS_TOKEN = "tok3n-de-prueba";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "111222333";
  process.env.WHATSAPP_DEFAULT_TO = "+5213221234567";
  process.env.EGRESS_WHATSAPP_MODE = "allowlist";
  process.env.EGRESS_WHATSAPP_ALLOWLIST = "+5213221234567";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const k of ENV) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe("sendWhatsAppTemplate", () => {
  test("Smile More: POST a Graph con el payload literal de la plantilla", async () => {
    fetchMock.mockResolvedValueOnce(respuestaOk({ messages: [{ id: "wamid.SM.1" }] }));

    const result = await sendWhatsAppTemplate({
      formName: "Corrección y adaptación del sistema",
      clientName: "Smile More Dental",
      reference: "Guadalajara",
      responseId: "3f2c1b6a-0d1e-4a7b-9c8d-5e6f7a8b9c0d",
    });

    expect(result).toEqual({
      messageId: "wamid.SM.1",
      to: "+5213221234567",
      template: "nueva_respuesta_cuestionario",
      language: "es_MX",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/111222333/messages");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.headers.Authorization).toBe("Bearer tok3n-de-prueba");
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+5213221234567",
      type: "template",
      template: {
        name: "nueva_respuesta_cuestionario",
        language: { code: "es_MX" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Corrección y adaptación del sistema" },
              { type: "text", text: "Smile More Dental" },
              { type: "text", text: "Guadalajara" },
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [{ type: "text", text: "3f2c1b6a-0d1e-4a7b-9c8d-5e6f7a8b9c0d" }],
          },
        ],
      },
    });
  });

  test("Encino: mismos env/transporte, otro cliente; `to` explícito respeta la allowlist", async () => {
    fetchMock.mockResolvedValueOnce(respuestaOk({ messages: [{ id: "wamid.EN.1" }] }));

    const result = await sendWhatsAppTemplate({
      to: "+5213221234567",
      formName: "Formulario de prospectos",
      clientName: "Encino",
      reference: "Sitio web",
      responseId: "encino-lead-42",
    });

    expect(result.messageId).toBe("wamid.EN.1");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.type).toBe("template");
    expect(body.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual([
      "Formulario de prospectos",
      "Encino",
      "Sitio web",
    ]);
    expect(body.template.components[1]).toEqual({
      type: "button",
      sub_type: "url",
      index: 0,
      parameters: [{ type: "text", text: "encino-lead-42" }],
    });
    expect(JSON.stringify(body)).not.toMatch(/smile|guadalajara/i);
  });

  test("egress-guard fail-closed: destinatario fuera de allowlist no toca la red", async () => {
    await expect(
      sendWhatsAppTemplate({
        to: "+5219999999999",
        formName: "F",
        clientName: "C",
        reference: "R",
        responseId: "id",
      })
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("env faltante falla antes de la red y sin imprimir el token", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    await expect(
      sendWhatsAppTemplate({ formName: "F", clientName: "C", reference: "R", responseId: "id" })
    ).rejects.toThrow("WHATSAPP_ACCESS_TOKEN is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("131047 (ventana 24 h) llega tipado como MetaWhatsAppError con code/subcode/fbtrace", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 400,
      ok: false,
      type: "default",
      headers: { get: () => null },
      json: async () => ({
        error: {
          message: "Re-engagement message — texto libre de Meta",
          code: 131047,
          error_subcode: 2494010,
          fbtrace_id: "Atrace",
        },
      }),
    } as unknown as Response);

    let caught: unknown;
    try {
      await sendWhatsAppTemplate({ formName: "F", clientName: "C", reference: "R", responseId: "id" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MetaWhatsAppError);
    const e = caught as MetaWhatsAppError;
    expect(e.kind).toBe("api");
    expect(e.status).toBe(400);
    expect(e.code).toBe(131047);
    expect(e.subcode).toBe(2494010);
    expect(e.fbtraceId).toBe("Atrace");
    expect(e.message).toBe(
      "Meta WhatsApp API failed (400) [code=131047, subcode=2494010, fbtrace=Atrace]"
    );
    expect(e.message).not.toContain("Re-engagement");
  });

  test("variable vacía se rechaza localmente, sin llamar a Meta", async () => {
    await expect(
      sendWhatsAppTemplate({ formName: "F", clientName: "C", reference: "  ", responseId: "id" })
    ).rejects.toThrow(/"reference" is empty/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sendWhatsApp (texto libre) — sigue intacto", () => {
  test("envía type:text con el mismo transporte y errores con el mismo mensaje", async () => {
    fetchMock.mockResolvedValueOnce(respuestaOk({ messages: [{ id: "wamid.T.1" }] }));
    const r = await sendWhatsApp("hola");
    expect(r).toEqual({ messageId: "wamid.T.1", to: "+5213221234567" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+5213221234567",
      type: "text",
      text: { preview_url: false, body: "hola" },
    });

    await expect(sendWhatsApp("   ")).rejects.toThrow("Message body is empty");
  });
});
