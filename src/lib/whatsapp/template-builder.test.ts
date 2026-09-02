import { describe, expect, test } from "vitest";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_LANGUAGES,
  TemplateValidationError,
  buildTemplateCreatePayload,
  validateTemplateInput,
} from "./template-builder";

/**
 * Builder PURO de creación de plantillas (WO-2026-00181).
 *
 * Sin env, sin fetch, sin Next: entra la forma que manda la UI y sale el
 * payload EXACTO que espera `POST /{waba_id}/message_templates`. Todo lo que
 * Meta rechazaría (nombre con mayúsculas, variables con huecos, ejemplos que no
 * cuadran) se detecta aquí, antes de la red, con mensajes en español.
 */

const BASE = {
  name: "pedido_listo",
  language: "es_MX",
  category: "UTILITY",
  body: "Hola {{1}}, tu pedido {{2}} ya está listo.",
  examples: ["Miguel", "A-1024"],
};

function errores(input: unknown): string[] {
  const result = validateTemplateInput(input);
  if (result.ok) throw new Error("se esperaba una validación fallida");
  return result.errors;
}

describe("validateTemplateInput — casos válidos", () => {
  test("cuerpo con variables + ejemplos, footer y header opcionales", () => {
    const result = validateTemplateInput({ ...BASE, footer: "PixelTEC", headerText: "Actualización" });
    expect(result).toEqual({
      ok: true,
      value: {
        name: "pedido_listo",
        language: "es_MX",
        category: "UTILITY",
        body: "Hola {{1}}, tu pedido {{2}} ya está listo.",
        examples: ["Miguel", "A-1024"],
        footer: "PixelTEC",
        headerText: "Actualización",
      },
    });
  });

  test("cuerpo sin variables: los ejemplos no hacen falta", () => {
    const result = validateTemplateInput({
      name: "aviso_horario",
      language: "en_US",
      category: "MARKETING",
      body: "We are open from 9 to 6.",
    });
    expect(result.ok).toBe(true);
  });

  test("array de ejemplos vacío es equivalente a no mandarlos", () => {
    const result = validateTemplateInput({
      name: "aviso_horario",
      language: "es",
      category: "UTILITY",
      body: "Abrimos de 9 a 6.",
      examples: [],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: "aviso_horario",
        language: "es",
        category: "UTILITY",
        body: "Abrimos de 9 a 6.",
        examples: [],
      },
    });
  });

  test("los espacios de los bordes se recortan antes de validar", () => {
    const result = validateTemplateInput({
      name: "  pedido_listo  ",
      language: " es_MX ",
      category: " utility ",
      body: "  Todo listo.  ",
      footer: "  PixelTEC  ",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: "pedido_listo",
        language: "es_MX",
        category: "UTILITY",
        body: "Todo listo.",
        examples: [],
        footer: "PixelTEC",
      },
    });
  });

  test("una misma variable repetida cuenta una sola vez", () => {
    const result = validateTemplateInput({
      ...BASE,
      body: "Hola {{1}}, gracias {{1}}.",
      examples: ["Miguel"],
    });
    expect(result.ok).toBe(true);
  });

  test("los 4 idiomas y las 2 categorías del contrato se aceptan", () => {
    for (const language of TEMPLATE_LANGUAGES) {
      for (const category of TEMPLATE_CATEGORIES) {
        expect(validateTemplateInput({ ...BASE, language, category }).ok, `${language}/${category}`).toBe(
          true
        );
      }
    }
  });
});

describe("validateTemplateInput — casos inválidos", () => {
  test("input que no es objeto", () => {
    expect(errores(null)).toEqual(["El cuerpo de la plantilla debe ser un objeto JSON."]);
    expect(errores("plantilla")).toEqual(["El cuerpo de la plantilla debe ser un objeto JSON."]);
    expect(errores([])).toEqual(["El cuerpo de la plantilla debe ser un objeto JSON."]);
  });

  test("name: mayúsculas, espacios, guiones o vacío", () => {
    for (const name of ["Pedido_Listo", "pedido listo", "pedido-listo", "", "  ", "pedido!"]) {
      expect(errores({ ...BASE, name }), name).toContain(
        "name: solo se admiten minúsculas, números y guion bajo (1 a 512 caracteres)."
      );
    }
  });

  test("name: más de 512 caracteres", () => {
    expect(errores({ ...BASE, name: "a".repeat(513) })).toContain(
      "name: solo se admiten minúsculas, números y guion bajo (1 a 512 caracteres)."
    );
    expect(validateTemplateInput({ ...BASE, name: "a".repeat(512) }).ok).toBe(true);
  });

  test("language fuera del contrato", () => {
    expect(errores({ ...BASE, language: "pt_BR" })).toContain(
      "language: idioma no admitido. Usa uno de: es_MX, es, en_US, en."
    );
  });

  test("category AUTHENTICATION queda excluida a propósito", () => {
    expect(errores({ ...BASE, category: "AUTHENTICATION" })).toContain(
      "category: categoría no admitida. Usa UTILITY o MARKETING (AUTHENTICATION no está soportada)."
    );
  });

  test("body vacío o mayor a 1024", () => {
    expect(errores({ ...BASE, body: "   " })).toContain("body: el cuerpo es obligatorio.");
    expect(errores({ ...BASE, body: "x".repeat(1025), examples: [] })).toContain(
      "body: el cuerpo no puede superar 1024 caracteres."
    );
    expect(
      validateTemplateInput({ ...BASE, body: "x".repeat(1024), examples: [] }).ok
    ).toBe(true);
  });

  test("variables con hueco o que no arrancan en 1", () => {
    expect(errores({ ...BASE, body: "Hola {{1}} y {{3}}.", examples: ["a", "b"] })).toContain(
      "body: las variables deben ser correlativas desde {{1}} y sin huecos (encontradas: {{1}}, {{3}})."
    );
    expect(errores({ ...BASE, body: "Hola {{2}}.", examples: ["a"] })).toContain(
      "body: las variables deben ser correlativas desde {{1}} y sin huecos (encontradas: {{2}})."
    );
    expect(errores({ ...BASE, body: "Hola {{0}}.", examples: ["a"] })).toContain(
      "body: las variables deben ser correlativas desde {{1}} y sin huecos (encontradas: {{0}})."
    );
  });

  test("ejemplos ausentes, de más, de menos o vacíos", () => {
    expect(errores({ ...BASE, examples: undefined })).toContain(
      "examples: se requiere un ejemplo por cada variable del cuerpo (2)."
    );
    expect(errores({ ...BASE, examples: ["solo-uno"] })).toContain(
      "examples: se requiere un ejemplo por cada variable del cuerpo (2)."
    );
    expect(errores({ ...BASE, examples: ["a", "b", "c"] })).toContain(
      "examples: se requiere un ejemplo por cada variable del cuerpo (2)."
    );
    expect(errores({ ...BASE, examples: ["Miguel", "   "] })).toContain(
      "examples: ningún ejemplo puede estar vacío."
    );
    expect(errores({ ...BASE, examples: [1, 2] })).toContain(
      "examples: cada ejemplo debe ser texto."
    );
  });

  test("ejemplos en un cuerpo sin variables", () => {
    expect(errores({ ...BASE, body: "Sin variables.", examples: ["sobra"] })).toContain(
      "examples: el cuerpo no tiene variables, no envíes ejemplos."
    );
  });

  test("footer y headerText fuera de límite", () => {
    expect(errores({ ...BASE, footer: "f".repeat(61) })).toContain(
      "footer: el pie no puede superar 60 caracteres."
    );
    expect(errores({ ...BASE, headerText: "h".repeat(61) })).toContain(
      "headerText: el encabezado no puede superar 60 caracteres."
    );
    expect(errores({ ...BASE, headerText: "Pedido {{1}}" })).toContain(
      "headerText: el encabezado no admite variables."
    );
  });

  test("se acumulan todos los errores, no solo el primero", () => {
    const lista = errores({ name: "MAL", language: "pt_BR", category: "AUTHENTICATION", body: "" });
    expect(lista).toHaveLength(4);
  });
});

describe("buildTemplateCreatePayload — payload exacto", () => {
  test("header + body con ejemplos + footer", () => {
    expect(
      buildTemplateCreatePayload({ ...BASE, footer: "PixelTEC", headerText: "Actualización" })
    ).toEqual({
      name: "pedido_listo",
      language: "es_MX",
      category: "UTILITY",
      components: [
        { type: "HEADER", format: "TEXT", text: "Actualización" },
        {
          type: "BODY",
          text: "Hola {{1}}, tu pedido {{2}} ya está listo.",
          example: { body_text: [["Miguel", "A-1024"]] },
        },
        { type: "FOOTER", text: "PixelTEC" },
      ],
    });
  });

  test("sin variables: BODY sin `example`, y sin HEADER ni FOOTER", () => {
    expect(
      buildTemplateCreatePayload({
        name: "aviso_horario",
        language: "en",
        category: "MARKETING",
        body: "We are open from 9 to 6.",
      })
    ).toEqual({
      name: "aviso_horario",
      language: "en",
      category: "MARKETING",
      components: [{ type: "BODY", text: "We are open from 9 to 6." }],
    });
  });

  test("entrada inválida lanza TemplateValidationError con la lista de errores", () => {
    try {
      buildTemplateCreatePayload({ ...BASE, name: "MAL" });
      throw new Error("debió lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(TemplateValidationError);
      const e = err as TemplateValidationError;
      expect(e.code).toBe("invalid_template");
      expect(e.errors).toContain(
        "name: solo se admiten minúsculas, números y guion bajo (1 a 512 caracteres)."
      );
    }
  });

  test("es puro: no muta la entrada", () => {
    const input = { ...BASE, examples: ["Miguel", "A-1024"] };
    const copia = JSON.parse(JSON.stringify(input));
    buildTemplateCreatePayload(input);
    expect(input).toEqual(copia);
  });
});
