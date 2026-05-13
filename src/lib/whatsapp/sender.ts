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
 * También usado por el cron de Fase 4 del Asistente (reporte semanal).
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
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[whatsapp] send failed (network)", { error: detail, to: masked });
    throw new Error(`Meta WhatsApp API network error: ${detail}`);
  }

  const json = (await res.json().catch(() => ({}))) as MetaApiResponse;

  if (!res.ok) {
    const errMsg = json?.error?.message ?? "Unknown Meta API error";
    const errCode = json?.error?.code ?? "unknown";
    const subcode = json?.error?.error_subcode ?? null;
    const trace = json?.error?.fbtrace_id ?? null;
    const retryAfter = res.headers.get("retry-after");

    const details =
      `Meta WhatsApp API failed (${res.status}): ${errMsg} ` +
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
