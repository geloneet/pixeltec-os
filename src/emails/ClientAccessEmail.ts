/**
 * Access code email sent to client when they request portal access.
 */

import { clientLayout, escapeHtml } from './shared';

export interface ClientAccessEmailProps {
  clientName:  string;
  companyName: string;
  code:        string;
  portalUrl:   string;
  expiresIn:   string;
}

export function renderClientAccessEmail(props: ClientAccessEmailProps): string {
  const { clientName, companyName, code, portalUrl, expiresIn } = props;

  const digitHtml = code
    .split('')
    .map(d => `<span style="display:inline-block;width:44px;height:56px;line-height:56px;text-align:center;font-size:28px;font-weight:800;color:#06b6d4;background:#06b6d41a;border:2px solid #06b6d433;border-radius:10px;margin:0 4px;">${d}</span>`)
    .join('');

  return clientLayout({
    title: 'Acceso a tu Portal — PixelTEC',
    subtitle: 'Portal de Clientes',
    body: `
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1.5px;">
        C&oacute;digo de Acceso
      </p>
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#ffffff;">
        Hola, ${escapeHtml(clientName)}
      </h1>
      <p style="margin:0 0 32px;font-size:15px;color:#a1a1aa;line-height:1.5;">
        Aqu&iacute; est&aacute; tu c&oacute;digo de acceso &uacute;nico para
        <strong style="color:#ffffff;">${escapeHtml(companyName)}</strong>.
      </p>

      <div style="text-align:center;margin:0 0 28px;">
        ${digitHtml}
      </div>

      <div style="background:#1c1917;border:1px solid #292524;border-radius:10px;padding:14px 18px;margin-bottom:28px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#78716c;">
          &#9201; Este c&oacute;digo expira en <strong style="color:#f5f5f4;">${escapeHtml(expiresIn)}</strong>
        </p>
      </div>

      <div style="text-align:center;">
        <a href="${portalUrl}" style="display:inline-block;background:#06b6d4;color:#000000;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:-0.3px;">
          Ir a mi Portal →
        </a>
      </div>

      <p style="margin:28px 0 0;font-size:12px;color:#52525b;text-align:center;line-height:1.6;">
        Si no solicitaste este c&oacute;digo, puedes ignorar este mensaje.<br/>
        <a href="${portalUrl}" style="color:#71717a;word-break:break-all;">${portalUrl}</a>
      </p>`,
  });
}
