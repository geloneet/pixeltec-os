/**
 * Task assignment notification email.
 * Sent to the team when a new task is created.
 */

export interface TaskAssignedEmailProps {
  taskTitle: string;
  responsible: string;
  status: string;
  dueDate?: string; // formatted, e.g. "20 Mar, 2025"
}

export function renderTaskAssignedEmail(props: TaskAssignedEmailProps): string {
  const { taskTitle, responsible, status, dueDate } = props;

  const dueDateHtml = dueDate
    ? `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;width:40%;">Fecha límite</td>
        <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#09090b;font-weight:600;">${dueDate}</td>
      </tr>`
    : '';

  const statusColor = status === 'En proceso' ? '#f59e0b' : '#06b6d4';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nueva Tarea Asignada — PixelTEC OS</title>
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
                <span style="font-size:13px;font-weight:400;color:#71717a;margin-left:12px;">OS · Tareas</span>
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border:1px solid #e4e4e7;border-top:none;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1px;">
                Nueva tarea creada
              </p>
              <h1 style="margin:0 0 28px;font-size:22px;font-weight:700;color:#09090b;line-height:1.3;">
                ${taskTitle}
              </h1>

              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;width:40%;">Responsable</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;">
                    <span style="display:inline-flex;align-items:center;gap:6px;font-weight:600;color:#09090b;">
                      ${responsible}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;">Estado</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;">
                    <span style="display:inline-block;background:${statusColor}1a;color:${statusColor};border:1px solid ${statusColor}33;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:600;">
                      ${status}
                    </span>
                  </td>
                </tr>
                ${dueDateHtml}
              </table>

              <div style="border-left:3px solid #06b6d4;padding-left:16px;margin-top:28px;">
                <p style="margin:0;font-size:13px;color:#71717a;">
                  Accede al sistema para ver el detalle completo y actualizar el progreso de la tarea.
                </p>
              </div>
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
