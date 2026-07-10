/**
 * Código de acceso al portal de clientes — enviado a `clients.email` cuando
 * el cliente solicita entrar a /portal.
 */

import { clientLayout, escapeHtml } from './shared';

export interface ClientPortalAccessEmailProps {
  clientName: string;
  code: string;
  expiresIn: string;
  portalUrl: string;
}

export function renderClientPortalAccessEmail(props: ClientPortalAccessEmailProps): string {
  const { clientName, code, expiresIn, portalUrl } = props;

  return clientLayout({
    title: 'Tu código de acceso — PixelTEC',
    subtitle: 'Portal de Clientes',
    body: `
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1.5px;">
        C&oacute;digo de acceso
      </p>
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#ffffff;">
        Hola, ${escapeHtml(clientName)}
      </h1>
      <p style="margin:0 0 28px;font-size:15px;color:#a1a1aa;line-height:1.5;">
        Usa este c&oacute;digo para entrar a tu portal en <a href="${portalUrl}" style="color:#06b6d4;">${portalUrl}</a>.
      </p>

      <div style="text-align:center;margin:0 0 28px;">
        <span style="display:inline-block;background:#18181b;border:1px solid #292524;color:#ffffff;font-weight:700;font-size:32px;letter-spacing:0.4em;padding:16px 24px;border-radius:10px;">
          ${escapeHtml(code)}
        </span>
      </div>

      <div style="background:#1c1917;border:1px solid #292524;border-radius:10px;padding:14px 18px;margin-bottom:28px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#78716c;">
          &#9201; Este c&oacute;digo expira en <strong style="color:#f5f5f4;">${escapeHtml(expiresIn)}</strong> y solo puede usarse una vez.
        </p>
      </div>

      <p style="margin:28px 0 0;font-size:12px;color:#52525b;text-align:center;line-height:1.6;">
        Si no solicitaste este c&oacute;digo, puedes ignorar este mensaje.
      </p>`,
  });
}
