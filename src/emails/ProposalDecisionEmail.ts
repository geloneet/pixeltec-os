/**
 * Aviso interno al equipo cuando un cliente decide (acepta/rechaza) una
 * propuesta desde la página pública /p/[token]. Patrón espejo de
 * DiagnosticNotificationEmail.ts.
 */

import { internalLayout, escapeHtml } from './shared';

export interface ProposalDecisionEmailProps {
  action: 'aceptada' | 'rechazada';
  title: string;
  clientName: string;
  /** Resumen de inversión ya formateado ('' si no hay conceptos). */
  investmentSummary: string;
  decidedAt: string;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:13px;color:#71717a;width:140px;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:14px;color:#09090b;font-weight:600;">${value}</td>
  </tr>`;
}

export function renderProposalDecisionEmail(props: ProposalDecisionEmailProps): string {
  const accepted = props.action === 'aceptada';
  const client = props.clientName.trim() || 'Un cliente';

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#09090b;">
      Propuesta ${accepted ? 'aceptada ✅' : 'rechazada ❌'}
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">
      Decidida por el cliente en su link público · ${escapeHtml(props.decidedAt)}
    </p>

    <div style="background:#f4f4f5;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        ${row('Cliente', escapeHtml(client))}
        ${row('Propuesta', escapeHtml(props.title))}
        ${props.investmentSummary ? row('Inversión', escapeHtml(props.investmentSummary)) : ''}
      </table>
    </div>

    <a href="https://pixeltec.mx/crm"
       style="display:inline-block;background:#09090b;color:#fafafa;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">
      Abrir el CRM →
    </a>
  `;

  return internalLayout({
    title: `Propuesta ${props.action} — ${props.title}`,
    section: 'Propuestas',
    body,
  });
}
