/**
 * Envío de la cotización por WhatsApp (WO-2026-00101).
 *
 * NO usa la API de Meta. El módulo WhatsApp de PixelTEC OS está congelado por
 * la revisión de Meta, su emisor solo admite una plantilla fija y nunca se ha
 * hecho un envío real; mandar un PDF por ahí exigiría una plantilla nueva
 * aprobada por Meta y tocar código congelado.
 *
 * En su lugar se construye un enlace `wa.me` que abre WhatsApp con el mensaje
 * ya escrito: Miguel pulsa enviar. Funciona hoy, no toca nada congelado y no
 * depende de ninguna aprobación.
 *
 * Módulo puro — sin `db`, sin `next`.
 */

/**
 * Normaliza un teléfono a los dígitos que espera wa.me (E.164 sin «+»).
 * Asume México cuando el número viene con 10 dígitos y sin lada de país, que
 * es como se capturan los teléfonos en el CRM.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  // 10 dígitos → número nacional mexicano: se antepone 52.
  if (digits.length === 10) return `52${digits}`;
  // 521XXXXXXXXXX: forma antigua con el «1» de móvil; WhatsApp ya no lo usa.
  if (digits.length === 13 && digits.startsWith('521')) return `52${digits.slice(3)}`;
  // Longitudes fuera del rango internacional plausible: no se inventa nada.
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export interface QuoteShareInput {
  clientName: string;
  folio: string;
  title: string;
  total: string;
  /** URL pública de la cotización. */
  url: string;
  validUntil?: string | null;
}

/** Mensaje que se prellena en WhatsApp. Texto llano, sin adornos. */
export function buildWhatsAppMessage(input: QuoteShareInput): string {
  const lines = [
    `Hola ${input.clientName}, te comparto la cotización ${input.folio}.`,
    '',
    `${input.title}`,
    `Total: ${input.total}`,
  ];
  if (input.validUntil) lines.push(`Vigencia: ${input.validUntil}`);
  lines.push('', input.url);
  return lines.join('\n');
}

/**
 * Enlace que abre WhatsApp con el mensaje listo. `null` si el teléfono no
 * sirve — es preferible esconder el botón que abrir un chat con nadie.
 */
export function buildWhatsAppLink(phone: string | null | undefined, input: QuoteShareInput): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(buildWhatsAppMessage(input))}`;
}

/** Asunto y cuerpo del correo. El PDF viaja adjunto. */
export function buildEmailSubject(input: Pick<QuoteShareInput, 'folio' | 'title'>): string {
  return `Cotización ${input.folio} — ${input.title}`;
}
