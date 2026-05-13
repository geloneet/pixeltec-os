/**
 * Internal notification email sent to the PixelTEC team whenever the
 * public contact form is submitted. Light "internal" layout with a
 * one-click reply CTA.
 */

import { internalLayout, escapeHtml } from './shared';

export interface ContactNotificationEmailProps {
  name: string;
  email: string;
  message: string;
  empresa?: string;
  submittedAt: string;
  source?: string;
}

export function renderContactNotificationEmail(props: ContactNotificationEmailProps): string {
  const { name, email, message, empresa, submittedAt, source = 'pixeltec.mx' } = props;

  const empresaRow = empresa
    ? `<tr>
         <td style="padding:8px 0;font-size:13px;color:#71717a;width:120px;">Empresa</td>
         <td style="padding:8px 0;font-size:14px;color:#09090b;font-weight:600;">${escapeHtml(empresa)}</td>
       </tr>`
    : '';

  const replySubject = encodeURIComponent(`Re: tu mensaje en PixelTEC`);
  const replyBody = encodeURIComponent(`Hola ${name},\n\nGracias por contactarnos. `);

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#09090b;">
      Nuevo contacto desde la web
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">
      ${escapeHtml(source)} · ${escapeHtml(submittedAt)}
    </p>

    <div style="background:#f4f4f5;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#71717a;width:120px;">Nombre</td>
          <td style="padding:8px 0;font-size:14px;color:#09090b;font-weight:600;">${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#71717a;width:120px;">Email</td>
          <td style="padding:8px 0;font-size:14px;color:#09090b;font-weight:600;">
            <a href="mailto:${escapeHtml(email)}" style="color:#0891b2;text-decoration:none;">${escapeHtml(email)}</a>
          </td>
        </tr>
        ${empresaRow}
      </table>
    </div>

    <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1.5px;">
      Mensaje
    </p>
    <div style="border-left:3px solid #06b6d4;padding:8px 0 8px 16px;margin-bottom:28px;">
      <p style="margin:0;font-size:14px;line-height:1.7;color:#27272a;white-space:pre-wrap;">${escapeHtml(message)}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="mailto:${escapeHtml(email)}?subject=${replySubject}&body=${replyBody}"
             style="display:inline-block;background:#09090b;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px;">
            Responder a ${escapeHtml(name)} →
          </a>
        </td>
      </tr>
    </table>
  `;

  return internalLayout({
    title: `Nuevo contacto — ${name}`,
    section: 'Contacto Web',
    body,
  });
}
