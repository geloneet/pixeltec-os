/**
 * Invoice / payment confirmation email.
 * Sent internally to the team when a transaction is marked as "Pagado".
 */

export interface InvoiceEmailProps {
  clientName: string;
  projectName: string;
  amount: number;
  method: string;
  type: string;
  date: string; // formatted date string
}

function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

export function renderInvoiceEmail(props: InvoiceEmailProps): string {
  const { clientName, projectName, amount, method, type, date } = props;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pago Registrado — PixelTEC OS</title>
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
                <span style="font-size:13px;font-weight:400;color:#71717a;margin-left:12px;">OS · Finanzas</span>
              </p>
            </td>
          </tr>

          <!-- Green status banner -->
          <tr>
            <td style="background:#052e16;padding:16px 40px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#4ade80;">
                ✓ Pago registrado exitosamente
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
              <p style="margin:0 0 24px;font-size:15px;color:#52525b;">
                Se ha confirmado el siguiente pago en el sistema:
              </p>

              <!-- Amount highlight -->
              <div style="text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:28px;margin-bottom:28px;">
                <p style="margin:0 0 4px;font-size:13px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                  Monto recibido
                </p>
                <p style="margin:0;font-size:40px;font-weight:800;color:#15803d;font-variant-numeric:tabular-nums;">
                  ${formatMXN(amount)}
                </p>
              </div>

              <!-- Transaction details table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;width:40%;">Cliente</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#09090b;font-weight:600;">${clientName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;">Proyecto</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#09090b;">${projectName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;">Tipo</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#09090b;">${type}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;">Método</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#09090b;">${method}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#71717a;">Fecha</td>
                  <td style="padding:10px 0;color:#09090b;">${date}</td>
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
