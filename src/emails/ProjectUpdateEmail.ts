/**
 * Project update notification email sent to client when admin posts an update.
 */

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
    ? `<div style="margin-bottom:20px;border-radius:12px;overflow:hidden;"><img src="${imageUrl}" alt="Actualización del proyecto" style="width:100%;height:auto;display:block;max-height:300px;object-fit:cover;" /></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nueva Actualización — ${companyName}</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <p style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">
                Pixel<span style="color:#06b6d4;">TEC</span>
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:3px;">
                Actualización de Proyecto
              </p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#111111;border:1px solid #27272a;border-radius:20px;overflow:hidden;">
              <div style="height:3px;background:linear-gradient(90deg,#a3e635,#06b6d4);"></div>

              <div style="padding:40px;">
                <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#a3e635;text-transform:uppercase;letter-spacing:1.5px;">
                  ✦ Nueva actualización
                </p>
                <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#ffffff;">
                  ${companyName}
                </h1>

                <p style="margin:0 0 20px;font-size:15px;color:#a1a1aa;">
                  Hola <strong style="color:#fff;">${clientName}</strong>, tu equipo publicó una actualización:
                </p>

                <!-- Update content card -->
                <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:20px;">
                  ${imageSection}
                  <p style="margin:0;font-size:15px;color:#e4e4e7;line-height:1.7;">${updateText}</p>
                  <p style="margin:16px 0 0;font-size:12px;color:#52525b;">
                    — ${author} · ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}
                  </p>
                </div>

                <!-- CTA -->
                <div style="text-align:center;">
                  <a href="${portalUrl}" style="display:inline-block;background:#06b6d4;color:#000000;font-weight:700;font-size:14px;text-decoration:none;padding:12px 32px;border-radius:10px;">
                    Ver en mi Portal →
                  </a>
                </div>
              </div>
            </td>
          </tr>

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
