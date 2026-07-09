/**
 * Internal notification email sent to the PixelTEC team whenever a visitor
 * completes the public "Diagnóstico Inteligente" wizard. Patrón espejo de
 * ContactNotificationEmail.ts.
 */

import { internalLayout, escapeHtml } from './shared';

export interface DiagnosticNotificationEmailProps {
  name: string;
  email: string;
  phone?: string;
  empresa?: string;
  industry: string;
  companySize: string;
  problems: string[];
  priority: string;
  score: number;
  recommendedServices: string[];
  timeline: string;
  submittedAt: string;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:13px;color:#71717a;width:140px;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:14px;color:#09090b;font-weight:600;">${value}</td>
  </tr>`;
}

export function renderDiagnosticNotificationEmail(props: DiagnosticNotificationEmailProps): string {
  const {
    name,
    email,
    phone,
    empresa,
    industry,
    companySize,
    problems,
    priority,
    score,
    recommendedServices,
    timeline,
    submittedAt,
  } = props;

  const replySubject = encodeURIComponent('Re: tu Diagnóstico Estratégico PixelTEC');
  const replyBody = encodeURIComponent(`Hola ${name},\n\nVimos tu Diagnóstico Inteligente. `);

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#09090b;">
      Nuevo Diagnóstico Inteligente completado
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">
      pixeltec.mx/diagnostico · ${escapeHtml(submittedAt)}
    </p>

    <div style="background:#f4f4f5;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        ${row('Nombre', escapeHtml(name))}
        ${row('Email', `<a href="mailto:${escapeHtml(email)}" style="color:#0891b2;text-decoration:none;">${escapeHtml(email)}</a>`)}
        ${phone ? row('Teléfono', escapeHtml(phone)) : ''}
        ${empresa ? row('Empresa', escapeHtml(empresa)) : ''}
        ${row('Industria', escapeHtml(industry))}
        ${row('Tamaño', escapeHtml(companySize))}
        ${row('Prioridad', escapeHtml(priority))}
      </table>
    </div>

    <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1.5px;">
      Problemas reportados
    </p>
    <div style="border-left:3px solid #06b6d4;padding:8px 0 8px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:14px;line-height:1.7;color:#27272a;">${escapeHtml(problems.join(', '))}</p>
    </div>

    <div style="background:#ecfeff;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        ${row('Madurez digital', `${score}%`)}
        ${row('Servicios sugeridos', escapeHtml(recommendedServices.join(', ')))}
        ${row('Tiempo estimado', escapeHtml(timeline))}
      </table>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="mailto:${escapeHtml(email)}?subject=${replySubject}&body=${replyBody}"
             style="display:inline-block;background:#09090b;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px;">
            Responder a ${escapeHtml(name)} →
          </a>
        </td>
      </tr>
    </table>
  `;

  return internalLayout({
    title: `Nuevo Diagnóstico — ${name} (${score}%)`,
    section: 'Diagnóstico Inteligente',
    body,
  });
}
