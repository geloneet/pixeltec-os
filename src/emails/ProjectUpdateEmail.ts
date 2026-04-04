/**
 * Project update notification email sent to client when admin posts an update.
 */

import { clientLayout, escapeHtml } from './shared';

export interface ProjectUpdateEmailProps {
  clientName:  string;
  companyName: string;
  updateText:  string;
  author:      string;
  portalUrl:   string;
  imageUrl?:   string;
}

export function renderProjectUpdateEmail(props: ProjectUpdateEmailProps): string {
  const { clientName, companyName, updateText, author, portalUrl, imageUrl } = props;

  const imageSection = imageUrl
    ? `<div style="margin-bottom:20px;border-radius:12px;overflow:hidden;"><img src="${imageUrl}" alt="Actualizaci&oacute;n del proyecto" style="width:100%;height:auto;display:block;max-height:300px;object-fit:cover;" /></div>`
    : '';

  const today = new Date().toLocaleDateString('es-MX', { dateStyle: 'long' });

  return clientLayout({
    title: `Nueva Actualización — ${companyName}`,
    subtitle: 'Actualizaci&oacute;n de Proyecto',
    gradient: 'linear-gradient(90deg,#a3e635,#06b6d4)',
    body: `
      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#a3e635;text-transform:uppercase;letter-spacing:1.5px;">
        &#10022; Nueva actualizaci&oacute;n
      </p>
      <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#ffffff;">
        ${escapeHtml(companyName)}
      </h1>

      <p style="margin:0 0 20px;font-size:15px;color:#a1a1aa;">
        Hola <strong style="color:#fff;">${escapeHtml(clientName)}</strong>, tu equipo public&oacute; una actualizaci&oacute;n:
      </p>

      <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:20px;">
        ${imageSection}
        <p style="margin:0;font-size:15px;color:#e4e4e7;line-height:1.7;">${escapeHtml(updateText)}</p>
        <p style="margin:16px 0 0;font-size:12px;color:#52525b;">
          — ${escapeHtml(author)} &middot; ${today}
        </p>
      </div>

      <div style="text-align:center;">
        <a href="${portalUrl}" style="display:inline-block;background:#06b6d4;color:#000000;font-weight:700;font-size:14px;text-decoration:none;padding:12px 32px;border-radius:10px;">
          Ver en mi Portal →
        </a>
      </div>`,
  });
}
