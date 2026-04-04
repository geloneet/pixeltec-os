/**
 * Shared email layout helpers for PixelTEC OS.
 * Reduces HTML boilerplate duplication across all templates.
 */

const YEAR = new Date().getFullYear();
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Internal/team email layout — light background, 600px card with black header.
 */
export function internalLayout(opts: {
  title: string;
  section: string;
  body: string;
  banner?: string;
}): string {
  const { title, section, body, banner = '' } = opts;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT_STACK};">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:#000000;border-radius:16px 16px 0 0;padding:32px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">
                Pixel<span style="color:#06b6d4;">TEC</span>
                <span style="font-size:13px;font-weight:400;color:#71717a;margin-left:12px;">OS · ${section}</span>
              </p>
            </td>
          </tr>
          ${banner}
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Notificación interna · PixelTEC OS · ${YEAR}
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

/**
 * Client-facing email layout — dark background, 560px card with gradient accent.
 */
export function clientLayout(opts: {
  title: string;
  subtitle: string;
  gradient?: string;
  body: string;
  footerNote?: string;
}): string {
  const {
    title,
    subtitle,
    gradient = 'linear-gradient(90deg,#06b6d4,#a3e635)',
    body,
    footerNote,
  } = opts;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:${FONT_STACK};">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <p style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-1px;">
                Pixel<span style="color:#06b6d4;">TEC</span>
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:3px;">
                ${subtitle}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#111111;border:1px solid #27272a;border-radius:20px;overflow:hidden;">
              <div style="height:3px;background:${gradient};"></div>
              <div style="padding:40px;">
                ${body}
              </div>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#3f3f46;">
                ${footerNote ?? `&copy; ${YEAR} PixelTEC &middot; Guadalajara, M&eacute;xico`}
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

/** Escapes HTML special characters to prevent XSS in email content. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
