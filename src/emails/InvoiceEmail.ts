/**
 * Invoice / payment confirmation email.
 * Sent internally to the team when a transaction is marked as "Pagado".
 */

import { internalLayout, escapeHtml } from './shared';

export interface InvoiceEmailProps {
  clientName: string;
  projectName: string;
  amount: number;
  method: string;
  type: string;
  date: string;
}

function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

export function renderInvoiceEmail(props: InvoiceEmailProps): string {
  const { clientName, projectName, amount, method, type, date } = props;

  return internalLayout({
    title: 'Pago Registrado — PixelTEC OS',
    section: 'Finanzas',
    banner: `<tr>
      <td style="background:#052e16;padding:16px 40px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
        <p style="margin:0;font-size:14px;font-weight:600;color:#4ade80;">
          &#10003; Pago registrado exitosamente
        </p>
      </td>
    </tr>`,
    body: `
      <p style="margin:0 0 24px;font-size:15px;color:#52525b;">
        Se ha confirmado el siguiente pago en el sistema:
      </p>

      <div style="text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:28px;margin-bottom:28px;">
        <p style="margin:0 0 4px;font-size:13px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
          Monto recibido
        </p>
        <p style="margin:0;font-size:40px;font-weight:800;color:#15803d;font-variant-numeric:tabular-nums;">
          ${formatMXN(amount)}
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;width:40%;">Cliente</td>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#09090b;font-weight:600;">${escapeHtml(clientName)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;">Proyecto</td>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#09090b;">${escapeHtml(projectName)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;">Tipo</td>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#09090b;">${escapeHtml(type)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;">M&eacute;todo</td>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#09090b;">${escapeHtml(method)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#71717a;">Fecha</td>
          <td style="padding:10px 0;color:#09090b;">${escapeHtml(date)}</td>
        </tr>
      </table>`,
  });
}
