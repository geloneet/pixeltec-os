/**
 * Plantillas de WhatsApp (Meta Cloud API) — builders PUROS.
 *
 * Aquí no hay env, fetch ni DB: solo se construye el payload que Meta espera
 * para un mensaje `type: "template"`. El transporte vive en `sender.ts`
 * (`sendWhatsAppTemplate`). Mantener los builders puros permite verificar el
 * payload exacto en tests sin ningún envío real.
 *
 * Reference:
 *   - https://developers.facebook.com/docs/whatsapp/cloud-api/messages/template-messages
 *   - Variables: Meta rechaza saltos de línea, tabuladores y más de 4 espacios
 *     consecutivos dentro de un parámetro (error 132018 / 132012).
 *
 * REGLA: ningún valor de cliente, formulario o sucursal se escribe aquí.
 * Los datos entran por parámetros semánticos; los valores que Meta mostró en
 * la revisión de la plantilla son muestras, no constantes.
 */

/** Longitud máxima razonable por variable (Meta limita el cuerpo renderizado a 1024). */
const MAX_PARAM_LENGTH = 1024;

/**
 * Plantilla aprobada en Meta para avisar al equipo de una nueva respuesta de
 * cuestionario. Cuerpo: «Se recibió una nueva respuesta del cuestionario {{1}}
 * para {{2}}. / Referencia: {{3}} / Puedes revisar los detalles en PixelTEC OS.»
 * Botón 0 «Ver respuesta»: URL dinámica `https://pixeltec.mx/respuestas/{{1}}`.
 */
export const NUEVA_RESPUESTA_TEMPLATE = {
  name: "nueva_respuesta_cuestionario",
  language: "es_MX",
  /** Único botón aprobado en la plantilla (index 0). */
  urlButtonIndex: 0,
} as const;

export interface NuevaRespuestaTemplateInput {
  /** {{1}} — nombre del formulario/cuestionario (de su definición, no literal). */
  formName: string;
  /** {{2}} — nombre del cliente/proyecto dueño del formulario. */
  clientName: string;
  /** {{3}} — referencia contextual (sucursal, origen, etc.). */
  reference: string;
  /** Sufijo dinámico del botón: identifica la respuesta. Meta antepone la base aprobada. */
  responseId: string;
}

export interface TemplateTextParameter {
  type: "text";
  text: string;
}

export interface TemplateBodyComponent {
  type: "body";
  parameters: TemplateTextParameter[];
}

export interface TemplateUrlButtonComponent {
  type: "button";
  sub_type: "url";
  index: number;
  parameters: TemplateTextParameter[];
}

export interface WhatsAppTemplateMessage {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components: Array<TemplateBodyComponent | TemplateUrlButtonComponent>;
  };
}

/**
 * Normaliza una variable de plantilla al formato que Meta acepta: sin saltos
 * de línea ni tabuladores, sin runs de >4 espacios, recortada. Lanza si queda
 * vacía — una variable vacía hace que Meta rechace el mensaje completo.
 */
export function sanitizeTemplateParam(value: string, label: string): string {
  const cleaned = (value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {5,}/g, "    ")
    .trim()
    .slice(0, MAX_PARAM_LENGTH);
  if (!cleaned) throw new Error(`Template parameter "${label}" is empty`);
  return cleaned;
}

/**
 * Construye los componentes (body + botón URL) de `nueva_respuesta_cuestionario`.
 * Orden de las variables del cuerpo: [formName, clientName, reference].
 */
export function buildNuevaRespuestaTemplateComponents(
  input: NuevaRespuestaTemplateInput
): WhatsAppTemplateMessage["template"]["components"] {
  return [
    {
      type: "body",
      parameters: [
        { type: "text", text: sanitizeTemplateParam(input.formName, "formName") },
        { type: "text", text: sanitizeTemplateParam(input.clientName, "clientName") },
        { type: "text", text: sanitizeTemplateParam(input.reference, "reference") },
      ],
    },
    {
      type: "button",
      sub_type: "url",
      index: NUEVA_RESPUESTA_TEMPLATE.urlButtonIndex,
      // Solo el sufijo dinámico: la base `https://pixeltec.mx/respuestas/` la
      // pone Meta desde la definición aprobada de la plantilla.
      parameters: [{ type: "text", text: sanitizeTemplateParam(input.responseId, "responseId") }],
    },
  ];
}

/** Payload completo listo para POST /{phone_number_id}/messages. */
export function buildNuevaRespuestaTemplatePayload(
  to: string,
  input: NuevaRespuestaTemplateInput
): WhatsAppTemplateMessage {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: NUEVA_RESPUESTA_TEMPLATE.name,
      language: { code: NUEVA_RESPUESTA_TEMPLATE.language },
      components: buildNuevaRespuestaTemplateComponents(input),
    },
  };
}
