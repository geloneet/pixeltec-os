/**
 * Support ticket notification email.
 * Sent to the team when a new support ticket is opened.
 */

export interface SupportTicketEmailProps {
  ticketId: string;
  cliente: string;
  problema: string;
  categoria: string;
  prioridad: 'Baja' | 'Media' | 'Alta';
  createdAt: string; // formatted date string
}

export function renderSupportTicketEmail(props: SupportTicketEmailProps): string {
  const { ticketId, cliente, problema, categoria, prioridad, createdAt } = props;

  const prioridadConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
    Alta:  { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', label: '🔴 Alta' },
    Media: { bg: '#fffbeb', text: '#d97706', border: '#fde68a', label: '🟡 Media' },
    Baja:  { bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd', label: '🔵 Baja' },
  };

  const pConfig = prioridadConfig[prioridad] ?? prioridadConfig.Baja;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${ticketId} — Nuevo Ticket de Soporte</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#000000;border-radius:16px 16px 0 0;padding:32px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">
                Pixel<span style="color:#06b6d4;">TEC</span>
                <span style="font-size:13px;font-weight:400;color:#71717a;margin-left:12px;">OS · Soporte</span>
              </p>
            </td>
          </tr>

          <!-- Priority banner -->
          <tr>
            <td style="background:${pConfig.bg};border:1px solid ${pConfig.border};border-top:none;padding:14px 40px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
              <p style="margin:0;font-size:14px;font-weight:600;color:${pConfig.text};">
                Prioridad ${pConfig.label} · Ticket ${ticketId}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1px;">
                Nuevo ticket abierto
              </p>
              <h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:#09090b;">
                ${cliente}
              </h1>

              <!-- Problem description -->
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">
                  Descripción del problema
                </p>
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${problema}</p>
              </div>

              <!-- Details table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;width:40%;">Categoría</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#09090b;font-weight:600;">${categoria}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#71717a;">Creado</td>
                  <td style="padding:10px 0;color:#09090b;">${createdAt}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Notificación interna · PixelTEC OS · ${new Date().getFullYear()}
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
