/**
 * Sender de WhatsApp vía Meta Cloud API.
 *
 * Único transport de WhatsApp del sistema desde la migración del legacy
 * Twilio (ver historial git si necesitas el shim anterior). Usado por:
 *   - /api/notifications/test
 *   - /api/notifications/send
 *   - /api/notifications/daily
 *   - /api/notifications/charges
 *   - /api/whatsapp/send-test (smoke test)
 *
 * Reference:
 *   - https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 *   - Rate limits: https://developers.facebook.com/docs/whatsapp/cloud-api/overview#rate-limits
 *
 * Errores comunes:
 *   - 131030: número fuera de allowlist (modo desarrollo)
 *   - 131047: 24h customer service window expirada — requiere template
 *   - 131051: tipo de mensaje no soportado
 *   - 190:    token expirado
 *
 * Salt rotation: este módulo NO usa INTERNAL_IP_SALT. Si necesitas
 * rotar token de Meta, simplemente reemplaza WHATSAPP_ACCESS_TOKEN
 * en envs y redeploy — no hay caches.
 */

import { assertWhatsAppEgressAllowed } from "@/lib/egress-guard";

export interface SendWhatsAppOptions {
  /** Override del destinatario default (`WHATSAPP_DEFAULT_TO`). E.g. "5213221378336". */
  to?: string;
  /** Activa preview de enlaces en el mensaje. Default false. */
  previewUrl?: boolean;
}

export interface SendWhatsAppResult {
  /** wamid devuelto por Meta — único globalmente. */
  messageId: string;
  /** Número al que se entregó (post-resolución del default). */
  to: string;
}

const MAX_BODY = 4096; // Meta hard limit on text.body

// Mismo criterio que pixelbot-client.ts (15s). Los crons de notificaciones
// iteran usuarios: una conexión retenida sin timeout bloquea toda la iteración.
const SEND_TIMEOUT_MS = 15_000;

interface MetaApiError {
  message?: string;
  code?: number | string;
  error_subcode?: number | string;
  fbtrace_id?: string;
}

interface MetaApiResponse {
  error?: MetaApiError;
  messages?: Array<{ id?: string }>;
}

/** Replaces every digit except the last 4 with `*` so logs never leak full numbers. */
function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return phone.slice(0, -4).replace(/\d/g, "*") + phone.slice(-4);
}

export async function sendWhatsApp(
  message: string,
  options?: SendWhatsAppOptions
): Promise<SendWhatsAppResult> {
  // 1) Env validation — fail fast with a precise error.
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const defaultTo = process.env.WHATSAPP_DEFAULT_TO;
  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v21.0";

  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN is not configured");
  if (!phoneId) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured");

  const to = (options?.to ?? defaultTo)?.trim();
  if (!to) {
    throw new Error("No recipient — set WHATSAPP_DEFAULT_TO or pass options.to");
  }

  if (!message || !message.trim()) {
    throw new Error("Message body is empty");
  }

  // 2) Truncate if oversized — keep the suffix so the recipient knows.
  let body = message;
  if (body.length > MAX_BODY) {
    body = body.slice(0, MAX_BODY - 32) + "\n\n[mensaje truncado]";
  }

  const masked = maskPhone(to);

  // Fail-closed antes de construir la petición. La normalización a E.164 ocurre
  // dentro de la guarda y es solo para autorizar: `to` llega a Meta intacto.
  assertWhatsAppEgressAllowed(to);

  console.info("[whatsapp] sending to", masked);

  // 3) Call Meta Cloud API.
  const url = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: options?.previewUrl ?? false,
      body,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      // La spec sí elimina `Authorization` en un salto cross-origin, pero no
      // conviene depender de eso: el destino de `Location` lo elige el otro
      // extremo, y en el body viajan el teléfono y el texto del cliente.
      redirect: "manual",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.error("[whatsapp] send failed (timeout)", { to: masked, timeoutMs: SEND_TIMEOUT_MS });
      throw new Error(`Meta WhatsApp API timeout after ${SEND_TIMEOUT_MS}ms`);
    }
    // El error de undici cita host y puerto en `cause`; nada de él se propaga.
    console.error("[whatsapp] send failed (network)", { to: masked });
    throw new Error("Meta WhatsApp API network error");
  }

  // Antes de leer el cuerpo: un 3xx no se sigue ni se interpreta.
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    console.error("[whatsapp] send failed (redirect blocked)", { status: res.status, to: masked });
    throw new Error(`Meta WhatsApp API redirect blocked (${res.status})`);
  }

  const json = (await res.json().catch(() => ({}))) as MetaApiResponse;

  if (!res.ok) {
    // `error.message` es texto libre de Meta y puede citar el cuerpo enviado
    // —es decir, el mensaje del cliente—. Se descarta. Los códigos numéricos y
    // el fbtrace sí son estables, opacos y accionables para soporte.
    const errCode = json?.error?.code ?? "unknown";
    const subcode = json?.error?.error_subcode ?? null;
    const trace = json?.error?.fbtrace_id ?? null;
    const retryAfter = res.headers.get("retry-after");

    const details =
      `Meta WhatsApp API failed (${res.status}) ` +
      `[code=${errCode}` +
      `${subcode !== null ? `, subcode=${subcode}` : ""}` +
      `${trace ? `, fbtrace=${trace}` : ""}` +
      `${retryAfter ? `, retryAfter=${retryAfter}s` : ""}` +
      `]`;

    console.error("[whatsapp] send failed", { error: details, to: masked });
    // No automatic retry — caller decides policy (e.g. queue, alert, give up).
    throw new Error(details);
  }

  const messageId = json?.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("Meta returned 200 but no message id in response");
  }

  console.info("[whatsapp] sent", { messageId, to: masked });
  return { messageId, to };
}
