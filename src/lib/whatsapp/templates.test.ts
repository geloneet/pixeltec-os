import { describe, expect, test } from "vitest";
import {
  NUEVA_RESPUESTA_TEMPLATE,
  buildNuevaRespuestaTemplatePayload,
  sanitizeTemplateParam,
} from "./templates";

/**
 * Builder puro de `nueva_respuesta_cuestionario` — verifica el payload EXACTO
 * para dos clientes distintos sin ningún envío real. Los valores de Smile More
 * son las muestras de la revisión de Meta y ENTRAN como parámetros del test:
 * el módulo no los conoce (ver templates-no-hardcode.test.ts).
 */

const TO = "5213221234567";

describe("buildNuevaRespuestaTemplatePayload", () => {
  test("Smile More: body [form, cliente, sucursal] + botón url index 0 con el sufijo", () => {
    const payload = buildNuevaRespuestaTemplatePayload(TO, {
      formName: "Corrección y adaptación del sistema",
      clientName: "Smile More Dental",
      reference: "Guadalajara",
      responseId: "3f2c1b6a-0d1e-4a7b-9c8d-5e6f7a8b9c0d",
    });

    expect(payload).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: TO,
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

  test("Encino: mismo shape, otros datos — nada del payload depende de Smile More", () => {
    const payload = buildNuevaRespuestaTemplatePayload(TO, {
      formName: "Formulario de prospectos",
      clientName: "Encino",
      reference: "Sitio web",
      responseId: "encino-lead-42",
    });

    expect(payload.template.name).toBe(NUEVA_RESPUESTA_TEMPLATE.name);
    expect(payload.template.language.code).toBe("es_MX");
    expect(payload.template.components).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "Formulario de prospectos" },
          { type: "text", text: "Encino" },
          { type: "text", text: "Sitio web" },
        ],
      },
      {
        type: "button",
        sub_type: "url",
        index: 0,
        parameters: [{ type: "text", text: "encino-lead-42" }],
      },
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/smile|guadalajara/i);
  });

  test("el sufijo del botón NO incluye la URL base (Meta la antepone)", () => {
    const payload = buildNuevaRespuestaTemplatePayload(TO, {
      formName: "F",
      clientName: "C",
      reference: "R",
      responseId: "abc",
    });
    const button = payload.template.components[1];
    expect(button.type).toBe("button");
    expect(button.parameters[0].text).toBe("abc");
    expect(button.parameters[0].text).not.toContain("http");
  });

  test("sanitiza variables: saltos de línea, tabs y >4 espacios; vacío lanza", () => {
    expect(sanitizeTemplateParam("  Sucursal\nNorte\t(2)      x ", "reference")).toBe(
      "Sucursal Norte (2)    x"
    );
    expect(() => sanitizeTemplateParam("   \n ", "reference")).toThrow(/"reference" is empty/);
    expect(() =>
      buildNuevaRespuestaTemplatePayload(TO, {
        formName: "F",
        clientName: "",
        reference: "R",
        responseId: "id",
      })
    ).toThrow(/clientName/);
  });
});
