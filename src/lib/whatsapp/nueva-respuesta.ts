/**
 * Aviso «nueva respuesta de cuestionario» por plantilla + evidencia del envío
 * (WO-2026-00019, D-21a).
 *
 * PixelBot es el propietario del webhook de estados de WhatsApp (sent /
 * delivered / read / failed). PixelTEC OS NO lo duplica: solo deja constancia
 * de SU envío —message_id de Meta, plantilla, destinatario enmascarado,
 * timestamp y resultado inmediato— en el mecanismo persistente existente
 * (`system_alerts` vía `logSystemAlert`, consultable con psql / drizzle
 * studio; sin dashboards). El reflejo de statuses PixelBot → PixelTEC OS es
 * una capacidad posterior, fuera de este WO.
 *
 * Nunca lanza: el aviso es best-effort y jamás debe costar una respuesta ya
 * persistida. El caller decide qué hacer con `ok: false`.
 */

import { logSystemAlert } from "@/lib/system-alerts";
import {
  MetaWhatsAppError,
  maskPhone,
  sendWhatsAppTemplate,
  type SendWhatsAppTemplateOptions,
} from "./sender";
import { NUEVA_RESPUESTA_TEMPLATE } from "./templates";

/** `source` de la fila en system_alerts — filtro estable para soporte. */
export const WHATSAPP_TEMPLATE_EVIDENCE_SOURCE = "whatsapp_template";

export interface TemplateSendEvidence {
  template: string;
  language: string;
  /** Destinatario enmascarado (maskPhone) — nunca el número completo. */
  to: string;
  /** Fuente semántica del aviso (p. ej. "smilemore_qa") + id de la respuesta. */
  context: { source: string; responseId: string };
  sentAt: string;
  result: "accepted" | "failed";
  messageId?: string;
  error?: {
    kind: string;
    status: number | null;
    code: number | string | null;
    subcode: number | string | null;
    fbtraceId: string | null;
  };
}

export type NotifyNuevaRespuestaResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export interface NotifyNuevaRespuestaInput extends SendWhatsAppTemplateOptions {
  /** Identificador del flujo que avisa (va a la evidencia, no a Meta). */
  source: string;
}

function describeError(err: unknown): TemplateSendEvidence["error"] {
  if (err instanceof MetaWhatsAppError) {
    return {
      kind: err.kind,
      status: err.status,
      code: err.code,
      subcode: err.subcode,
      fbtraceId: err.fbtraceId,
    };
  }
  // Errores locales (env faltante, egress bloqueado, variable vacía): sin
  // código de Meta. El mensaje de estos errores no contiene datos del cliente.
  return { kind: "local", status: null, code: null, subcode: null, fbtraceId: null };
}

/**
 * Registra la evidencia de forma estructurada (log + system_alerts).
 * `to` DEBE llegar ya enmascarado.
 */
export async function recordTemplateSendEvidence(evidence: TemplateSendEvidence): Promise<void> {
  const level = evidence.result === "accepted" ? "info" : "warning";
  console[level === "info" ? "info" : "warn"]("[whatsapp] template evidence", evidence);
  await logSystemAlert({
    severity: level,
    source: WHATSAPP_TEMPLATE_EVIDENCE_SOURCE,
    message:
      evidence.result === "accepted"
        ? `template ${evidence.template} accepted by Meta`
        : `template ${evidence.template} send failed`,
    context: { ...evidence },
  });
}

/**
 * Envía la plantilla `nueva_respuesta_cuestionario` y registra la evidencia
 * del resultado inmediato, tanto en éxito como en fallo. Nunca lanza.
 */
export async function notifyNuevaRespuestaCuestionario(
  input: NotifyNuevaRespuestaInput
): Promise<NotifyNuevaRespuestaResult> {
  const { source, ...sendOptions } = input;
  const sentAt = new Date().toISOString();
  const context = { source, responseId: input.responseId };

  try {
    const sent = await sendWhatsAppTemplate(sendOptions);
    await recordTemplateSendEvidence({
      template: sent.template,
      language: sent.language,
      to: maskPhone(sent.to),
      context,
      sentAt,
      result: "accepted",
      messageId: sent.messageId,
    });
    return { ok: true, messageId: sent.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[whatsapp] template ${NUEVA_RESPUESTA_TEMPLATE.name} failed:`, message);
    await recordTemplateSendEvidence({
      template: NUEVA_RESPUESTA_TEMPLATE.name,
      language: NUEVA_RESPUESTA_TEMPLATE.language,
      to: maskPhone((input.to ?? process.env.WHATSAPP_DEFAULT_TO ?? "").trim() || "unknown"),
      context,
      sentAt,
      result: "failed",
      error: describeError(err),
    });
    return { ok: false, error: message };
  }
}
