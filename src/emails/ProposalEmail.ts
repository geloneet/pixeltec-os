/**
 * Sent to a client when a proposal is shared with them via email.
 */

import { clientLayout, escapeHtml } from './shared';

export interface ProposalEmailProps {
  clientName:    string;
  proposalTitle: string;
  publicUrl:     string;
}

export function renderProposalEmail(props: ProposalEmailProps): string {
  const { clientName, proposalTitle, publicUrl } = props;

  return clientLayout({
    title: 'Tu propuesta de PixelTEC está lista',
    subtitle: 'Propuesta Comercial',
    body: `
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1.5px;">
        Propuesta Comercial
      </p>
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#ffffff;">
        Hola, ${escapeHtml(clientName)}
      </h1>
      <p style="margin:0 0 32px;font-size:15px;color:#a1a1aa;line-height:1.5;">
        Preparamos una propuesta para
        <strong style="color:#ffffff;">${escapeHtml(proposalTitle)}</strong>.
        Puedes revisarla, descargar el PDF y aceptarla directamente desde el
        siguiente enlace.
      </p>

      <div style="text-align:center;">
        <a href="${publicUrl}" style="display:inline-block;background:#06b6d4;color:#000000;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:-0.3px;">
          Ver propuesta →
        </a>
      </div>

      <p style="margin:28px 0 0;font-size:12px;color:#52525b;text-align:center;line-height:1.6;">
        Si tienes cualquier duda, respondemos con gusto.<br/>
        <a href="${publicUrl}" style="color:#71717a;word-break:break-all;">${publicUrl}</a>
      </p>`,
  });
}
