/**
 * Cuerpo del correo de la cotización (WO-2026-00102).
 *
 * HTML plano y sobrio: el detalle va en el PDF adjunto. Módulo puro para poder
 * comprobar en un test que el enlace y el total salen y que nada se escapa sin
 * escapar.
 */

/** Escapa lo que viene de la base de datos antes de meterlo en el HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface QuoteEmailInput {
  clientName: string;
  folio: string;
  title: string;
  total: string;
  url: string;
  validUntil?: string | null;
}

export function renderQuoteEmailHtml(input: QuoteEmailInput): string {
  const e = escapeHtml;
  const vigencia = input.validUntil
    ? `<p style="margin:0 0 6px;color:#6b7280;font-size:13px">Vigencia: ${e(input.validUntil)}</p>`
    : '';

  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f6f7f9;font-family:Helvetica,Arial,sans-serif;color:#2b303b">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
    <p style="margin:0 0 18px;font-size:15px">Hola ${e(input.clientName)},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55">
      Te comparto la cotización <strong>${e(input.folio)}</strong>. El detalle completo va en el PDF adjunto.
    </p>
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 20px">
      <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#0a0d14">${e(input.title)}</p>
      ${vigencia}
      <p style="margin:0;font-size:20px;font-weight:700;color:#0a0d14">${e(input.total)}</p>
    </div>
    <p style="margin:0 0 22px">
      <a href="${e(input.url)}" style="display:inline-block;background:#1f6feb;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-size:14px;font-weight:600">Ver la cotización</a>
    </p>
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5">
      Cualquier duda, respóndeme a este correo.<br>PixelTEC · pixeltec.mx
    </p>
  </div>
</body></html>`;
}
