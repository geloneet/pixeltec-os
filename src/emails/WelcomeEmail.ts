/**
 * Welcome email sent to a new client when they are added to PixelTEC OS.
 */

import { escapeHtml } from './shared';

export interface WelcomeEmailProps {
  clientName: string;
  companyName: string;
  services: string[];
  assignedTo: string;
}

export function renderWelcomeEmail(props: WelcomeEmailProps): string {
  const { clientName, companyName, services, assignedTo } = props;
  const servicesHtml = services.length
    ? services.map(s => `<li style="margin:4px 0;color:#374151;">${escapeHtml(s)}</li>`).join('')
    : '<li style="color:#9ca3af;">Sin servicios especificados</li>';

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a PixelTEC</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#000000;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Pixel<span style="color:#06b6d4;">TEC</span>
              </p>
              <p style="margin:8px 0 0;font-size:13px;color:#71717a;letter-spacing:2px;text-transform:uppercase;">
                Digital Agency OS
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
              <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#09090b;">
                ¡Hola, ${escapeHtml(clientName)}!
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#71717a;">
                Nos da mucho gusto darte la bienvenida como cliente de PixelTEC.
              </p>

              <div style="background:#f4f4f5;border-radius:12px;padding:24px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1px;">
                  Tu cuenta
                </p>
                <p style="margin:0;font-size:20px;font-weight:700;color:#09090b;">${escapeHtml(companyName)}</p>
              </div>

              <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#09090b;">
                Servicios contratados:
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;">
                ${servicesHtml}
              </ul>

              <div style="border-left:3px solid #06b6d4;padding-left:16px;margin-bottom:24px;">
                <p style="margin:0;font-size:14px;color:#52525b;">
                  Tu punto de contacto directo es <strong style="color:#09090b;">${escapeHtml(assignedTo)}</strong>.
                  Cualquier duda o solicitud, no dudes en escribirnos.
                </p>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://pixeltec.mx" style="display:inline-block;background:#06b6d4;color:#000000;font-weight:700;font-size:14px;text-decoration:none;padding:12px 32px;border-radius:8px;">
                      Visitar nuestro sitio →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                &copy; ${year} PixelTEC &middot; Guadalajara, M&eacute;xico
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#a1a1aa;">
                Este mensaje fue generado autom&aacute;ticamente por PixelTEC OS.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
