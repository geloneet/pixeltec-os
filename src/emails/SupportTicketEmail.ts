/**
 * Support ticket notification email.
 * Sent to the team when a new support ticket is opened.
 */

import { internalLayout, escapeHtml } from './shared';

export interface SupportTicketEmailProps {
  ticketId: string;
  cliente: string;
  problema: string;
  categoria: string;
  prioridad: 'Baja' | 'Media' | 'Alta';
  createdAt: string;
}

export function renderSupportTicketEmail(props: SupportTicketEmailProps): string {
  const { ticketId, cliente, problema, categoria, prioridad, createdAt } = props;

  const prioridadConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
    Alta:  { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', label: 'Alta' },
    Media: { bg: '#fffbeb', text: '#d97706', border: '#fde68a', label: 'Media' },
    Baja:  { bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd', label: 'Baja' },
  };

  const pConfig = prioridadConfig[prioridad] ?? prioridadConfig.Baja;

  return internalLayout({
    title: `${ticketId} — Nuevo Ticket de Soporte`,
    section: 'Soporte',
    banner: `<tr>
      <td style="background:${pConfig.bg};border:1px solid ${pConfig.border};border-top:none;padding:14px 40px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
        <p style="margin:0;font-size:14px;font-weight:600;color:${pConfig.text};">
          Prioridad ${pConfig.label} &middot; Ticket ${escapeHtml(ticketId)}
        </p>
      </td>
    </tr>`,
    body: `
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1px;">
        Nuevo ticket abierto
      </p>
      <h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:#09090b;">
        ${escapeHtml(cliente)}
      </h1>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">
          Descripci&oacute;n del problema
        </p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(problema)}</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;width:40%;">Categor&iacute;a</td>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#09090b;font-weight:600;">${escapeHtml(categoria)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#71717a;">Creado</td>
          <td style="padding:10px 0;color:#09090b;">${escapeHtml(createdAt)}</td>
        </tr>
      </table>`,
  });
}
