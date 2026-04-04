/**
 * Task assignment notification email.
 * Sent to the team when a new task is created.
 */

import { internalLayout, escapeHtml } from './shared';

export interface TaskAssignedEmailProps {
  taskTitle: string;
  responsible: string;
  status: string;
  dueDate?: string;
}

export function renderTaskAssignedEmail(props: TaskAssignedEmailProps): string {
  const { taskTitle, responsible, status, dueDate } = props;

  const dueDateRow = dueDate
    ? `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;width:40%;">Fecha l&iacute;mite</td>
        <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#09090b;font-weight:600;">${escapeHtml(dueDate)}</td>
      </tr>`
    : '';

  const statusColor = status === 'En proceso' ? '#f59e0b' : '#06b6d4';

  return internalLayout({
    title: 'Nueva Tarea Asignada — PixelTEC OS',
    section: 'Tareas',
    body: `
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1px;">
        Nueva tarea creada
      </p>
      <h1 style="margin:0 0 28px;font-size:22px;font-weight:700;color:#09090b;line-height:1.3;">
        ${escapeHtml(taskTitle)}
      </h1>

      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;width:40%;">Responsable</td>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-weight:600;color:#09090b;">
            ${escapeHtml(responsible)}
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;">Estado</td>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;">
            <span style="display:inline-block;background:${statusColor}1a;color:${statusColor};border:1px solid ${statusColor}33;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:600;">
              ${escapeHtml(status)}
            </span>
          </td>
        </tr>
        ${dueDateRow}
      </table>

      <div style="border-left:3px solid #06b6d4;padding-left:16px;margin-top:28px;">
        <p style="margin:0;font-size:13px;color:#71717a;">
          Accede al sistema para ver el detalle completo y actualizar el progreso de la tarea.
        </p>
      </div>`,
  });
}
