/**
 * Access code email sent to client when they request portal access.
 */

export interface ClientAccessEmailProps {
  clientName:  string;
  companyName: string;
  code:        string;
  portalUrl:   string;
  expiresIn:   string; // e.g. "10 minutos"
}

export function renderClientAccessEmail(props: ClientAccessEmailProps): string {
  const { clientName, companyName, code, portalUrl, expiresIn } = props;
  const digits = code.split('');

  const digitHtml = digits
    .map(d => `<span style="display:inline-block;width:44px;height:56px;line-height:56px;text-align:center;font-size:28px;font-weight:800;color:#06b6d4;background:#06b6d41a;border:2px solid #06b6d433;border-radius:10px;margin:0 4px;">${d}</span>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Acceso a tu Portal — PixelTEC</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <p style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-1px;">
                Pixel<span style="color:#06b6d4;">TEC</span>
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:3px;">
                Portal de Clientes
              </p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#111111;border:1px solid #27272a;border-radius:20px;overflow:hidden;">

              <!-- Top gradient accent -->
              <div style="height:3px;background:linear-gradient(90deg,#06b6d4,#a3e635);"></div>

              <div style="padding:40px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1.5px;">
                  Código de Acceso
                </p>
                <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#ffffff;">
                  Hola, ${clientName}
                </h1>
                <p style="margin:0 0 32px;font-size:15px;color:#a1a1aa;line-height:1.5;">
                  Aquí está tu código de acceso único para
                  <strong style="color:#ffffff;">${companyName}</strong>.
                </p>

                <!-- Code display -->
                <div style="text-align:center;margin:0 0 28px;">
                  ${digitHtml}
                </div>

                <!-- Expiry notice -->
                <div style="background:#1c1917;border:1px solid #292524;border-radius:10px;padding:14px 18px;margin-bottom:28px;text-align:center;">
                  <p style="margin:0;font-size:13px;color:#78716c;">
                    ⏱ Este código expira en <strong style="color:#f5f5f4;">${expiresIn}</strong>
                  </p>
                </div>

                <!-- CTA Button -->
                <div style="text-align:center;">
                  <a href="${portalUrl}" style="display:inline-block;background:#06b6d4;color:#000000;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:-0.3px;">
                    Ir a mi Portal →
                  </a>
                </div>

                <p style="margin:28px 0 0;font-size:12px;color:#52525b;text-align:center;line-height:1.6;">
                  Si no solicitaste este código, puedes ignorar este mensaje.<br/>
                  <a href="${portalUrl}" style="color:#71717a;word-break:break-all;">${portalUrl}</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align:center;padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#3f3f46;">
                © ${new Date().getFullYear()} PixelTEC · Guadalajara, México
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
