/**
 * Builder PURO de creación de plantillas de WhatsApp (WO-2026-00181).
 *
 * Mismo principio que `templates.ts`: aquí no hay env, ni fetch, ni DB. Entra
 * lo que manda la UI (`unknown`, porque viene de un JSON de la red) y sale el
 * payload EXACTO de `POST /{waba_id}/message_templates`. El transporte vive en
 * `management.ts`.
 *
 * Por qué validar aquí y no dejar que Meta rechace: los errores de Graph al
 * crear plantillas son opacos («Invalid parameter»), llegan minutos después en
 * forma de plantilla REJECTED, y consumen cuota de creación. Un revisor de Meta
 * probando el flujo necesita ver el error en su idioma y al instante.
 *
 * Reference:
 *   - https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 *
 * REGLA: ningún valor de cliente se escribe aquí (ver `no-hardcode.test.ts`).
 */

import type {
  TemplateCategory,
  TemplateCreateInput,
  TemplateLanguage,
} from "./management-types";

export const TEMPLATE_LANGUAGES = ["es_MX", "es", "en_US", "en"] as const;

/** `AUTHENTICATION` se excluye a propósito (ver `management-types.ts`). */
export const TEMPLATE_CATEGORIES = ["UTILITY", "MARKETING"] as const;

const NAME_RE = /^[a-z0-9_]{1,512}$/;
const MAX_BODY = 1024;
const MAX_FOOTER = 60;
const MAX_HEADER = 60;

/** Variables de plantilla: Meta solo acepta la forma exacta `{{n}}`. */
const VARIABLE_RE = /\{\{(\d+)\}\}/g;

// ── Payload de Graph ─────────────────────────────────────────────────────────

export interface TemplateHeaderComponent {
  type: "HEADER";
  format: "TEXT";
  text: string;
}

export interface TemplateBodyComponent {
  type: "BODY";
  text: string;
  example?: { body_text: string[][] };
}

export interface TemplateFooterComponent {
  type: "FOOTER";
  text: string;
}

export type TemplateCreateComponent =
  | TemplateHeaderComponent
  | TemplateBodyComponent
  | TemplateFooterComponent;

export interface TemplateCreatePayload {
  name: string;
  language: TemplateLanguage;
  category: TemplateCategory;
  components: TemplateCreateComponent[];
}

// ── Validación ───────────────────────────────────────────────────────────────

export type TemplateValidationResult =
  | { ok: true; value: TemplateCreateInput }
  | { ok: false; errors: string[] };

/**
 * Entrada rechazada por el builder. `errors` es texto redactado por nosotros —
 * el único que puede cruzar hacia el navegador — y nunca cita credenciales ni
 * respuestas de terceros.
 */
export class TemplateValidationError extends Error {
  readonly code = "invalid_template" as const;
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`INVALID_TEMPLATE: ${errors.length} error(es)`);
    this.name = "TemplateValidationError";
    this.errors = errors;
    // Target < ES2015 rompe `instanceof` sobre subclases de Error nativas.
    Object.setPrototypeOf(this, TemplateValidationError.prototype);
  }
}

function texto(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

/** Índices distintos de las variables del texto, en orden de aparición. */
function variablesDe(text: string): number[] {
  const vistos: number[] = [];
  for (const match of text.matchAll(VARIABLE_RE)) {
    const index = Number(match[1]);
    if (!vistos.includes(index)) vistos.push(index);
  }
  return vistos;
}

/**
 * Valida la forma que manda la UI. Devuelve TODOS los errores, no el primero:
 * un diálogo que corrige un campo por intento es inutilizable en un screencast.
 */
export function validateTemplateInput(input: unknown): TemplateValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["El cuerpo de la plantilla debe ser un objeto JSON."] };
  }

  const raw = input as Record<string, unknown>;
  const errors: string[] = [];

  const name = texto(raw.name) ?? "";
  if (!NAME_RE.test(name)) {
    errors.push("name: solo se admiten minúsculas, números y guion bajo (1 a 512 caracteres).");
  }

  const language = texto(raw.language) ?? "";
  if (!(TEMPLATE_LANGUAGES as readonly string[]).includes(language)) {
    errors.push(`language: idioma no admitido. Usa uno de: ${TEMPLATE_LANGUAGES.join(", ")}.`);
  }

  // La categoría se normaliza a mayúsculas: es un enum, no texto libre, y un
  // `utility` en minúsculas es la misma intención escrita distinto.
  const category = (texto(raw.category) ?? "").toUpperCase();
  if (!(TEMPLATE_CATEGORIES as readonly string[]).includes(category)) {
    errors.push(
      "category: categoría no admitida. Usa UTILITY o MARKETING (AUTHENTICATION no está soportada)."
    );
  }

  const body = texto(raw.body) ?? "";
  let variables: number[] = [];
  if (body === "") {
    errors.push("body: el cuerpo es obligatorio.");
  } else if (body.length > MAX_BODY) {
    errors.push(`body: el cuerpo no puede superar ${MAX_BODY} caracteres.`);
  } else {
    variables = variablesDe(body);
    const correlativas = variables.every((n, i) => n === i + 1);
    if (!correlativas) {
      const encontradas = variables.map((n) => `{{${n}}}`).join(", ");
      errors.push(
        `body: las variables deben ser correlativas desde {{1}} y sin huecos (encontradas: ${encontradas}).`
      );
    }
  }

  // Ejemplos: obligatorios y exactos cuando hay variables. Meta los usa para
  // revisar la plantilla, y un desajuste la rechaza sin decir por qué.
  const examplesRaw = raw.examples;
  let examples: string[] = [];
  if (examplesRaw !== undefined && !Array.isArray(examplesRaw)) {
    errors.push("examples: debe ser una lista de textos.");
  } else {
    const lista = Array.isArray(examplesRaw) ? examplesRaw : [];
    if (lista.some((e) => typeof e !== "string")) {
      errors.push("examples: cada ejemplo debe ser texto.");
    } else {
      examples = lista.map((e) => (e as string).trim());
      if (variables.length > 0) {
        if (examples.length !== variables.length) {
          errors.push(
            `examples: se requiere un ejemplo por cada variable del cuerpo (${variables.length}).`
          );
        } else if (examples.some((e) => e === "")) {
          errors.push("examples: ningún ejemplo puede estar vacío.");
        }
      } else if (examples.length > 0) {
        errors.push("examples: el cuerpo no tiene variables, no envíes ejemplos.");
      }
    }
  }

  const footer = raw.footer === undefined ? undefined : texto(raw.footer) ?? "";
  if (raw.footer !== undefined && typeof raw.footer !== "string") {
    errors.push("footer: debe ser texto.");
  } else if (footer !== undefined && footer.length > MAX_FOOTER) {
    errors.push(`footer: el pie no puede superar ${MAX_FOOTER} caracteres.`);
  }

  const headerText = raw.headerText === undefined ? undefined : texto(raw.headerText) ?? "";
  if (raw.headerText !== undefined && typeof raw.headerText !== "string") {
    errors.push("headerText: debe ser texto.");
  } else if (headerText !== undefined) {
    if (headerText.length > MAX_HEADER) {
      errors.push(`headerText: el encabezado no puede superar ${MAX_HEADER} caracteres.`);
    }
    if (variablesDe(headerText).length > 0) {
      errors.push("headerText: el encabezado no admite variables.");
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const value: TemplateCreateInput = {
    name,
    language: language as TemplateLanguage,
    category: category as TemplateCategory,
    body,
    examples,
  };
  // Un pie o un encabezado vacíos son «no lo mandes», no un componente vacío:
  // Meta rechaza un FOOTER sin texto.
  if (footer !== undefined && footer !== "") value.footer = footer;
  if (headerText !== undefined && headerText !== "") value.headerText = headerText;

  return { ok: true, value };
}

/**
 * Payload listo para `POST /{waba_id}/message_templates`.
 *
 * Valida por su cuenta (no confía en que el llamador lo haya hecho) y lanza
 * `TemplateValidationError` con la lista completa. No muta la entrada.
 */
export function buildTemplateCreatePayload(input: unknown): TemplateCreatePayload {
  const validated = validateTemplateInput(input);
  if (!validated.ok) throw new TemplateValidationError(validated.errors);

  const { name, language, category, body, examples, footer, headerText } = validated.value;

  const components: TemplateCreateComponent[] = [];
  if (headerText) components.push({ type: "HEADER", format: "TEXT", text: headerText });

  const bodyComponent: TemplateBodyComponent = { type: "BODY", text: body };
  // `body_text` es una lista de LISTAS: Meta admite varios juegos de ejemplo;
  // aquí siempre se manda uno, con un valor por variable.
  if (examples.length > 0) bodyComponent.example = { body_text: [[...examples]] };
  components.push(bodyComponent);

  if (footer) components.push({ type: "FOOTER", text: footer });

  return { name, language, category, components };
}
