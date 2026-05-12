/**
 * Confirmation email sent to a visitor who submits the public contact form.
 * Dark, client-facing layout — echoes their message and sets response expectations.
 */

import { clientLayout, escapeHtml } from './shared';

export interface ContactConfirmationEmailProps {
  name: string;
  message: string;
  empresa?: string;
}

export function renderContactConfirmationEmail(props: ContactConfirmationEmailProps): string {
  const { name, message, empresa } = props;

  const empresaRow = empresa
    ? `<tr>
         <td style="padding:6px 0;font-size:13px;color:#71717a;width:120px;">Empresa</td>
         <td style="padding:6px 0;font-size:14px;color:#e4e4e7;font-weight:600;">${escapeHtml(empresa)}</td>
       </tr>`
    : '';

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#fafafa;letter-spacing:-0.5px;">
      Gracias, ${escapeHtml(name)}.
    </h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a1a1aa;">
      Recibimos tu mensaje y un especialista de PixelTEC lo está revisando.
      Te responderemos en <strong style="color:#06b6d4;">menos de 24 horas hábiles</strong>
      desde <a href="mailto:contacto@pixeltec.mx" style="color:#06b6d4;text-decoration:none;">contacto@pixeltec.mx</a>.
    </p>

    <div style="background:#0a0a0a;border:1px solid #27272a;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:2px;">
        Tu solicitud
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        ${empresaRow}
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#71717a;width:120px;vertical-align:top;">Mensaje</td>
          <td style="padding:6px 0;font-size:14px;color:#e4e4e7;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      Mientras tanto, si necesitas atención inmediata, escríbenos por WhatsApp.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="https://api.whatsapp.com/send?phone=523221378336&text=Hola,%20quiero%20informaci%C3%B3n."
             style="display:inline-block;background:#06b6d4;color:#000000;font-weight:700;font-size:14px;text-decoration:none;padding:13px 32px;border-radius:10px;">
            Continuar por WhatsApp →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:32px 0 0;font-size:12px;color:#52525b;text-align:center;">
      Si no realizaste esta solicitud, ignora este correo.
    </p>
  `;

  return clientLayout({
    title: `Recibimos tu mensaje — PixelTEC`,
    subtitle: 'Confirmación de contacto',
    body,
  });
}
