/**
 * Welcome / confirmation email sent the moment a visitor subscribes to the
 * PixelTEC newsletter from the public landing page.
 */

import { clientLayout, escapeHtml } from './shared';

export interface NewsletterWelcomeEmailProps {
  email: string;
  /** Absolute URL — passed in pre-built so this template stays env-agnostic. */
  unsubscribeUrl: string;
}

export function renderNewsletterWelcomeEmail(props: NewsletterWelcomeEmailProps): string {
  const { email, unsubscribeUrl } = props;

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#fafafa;letter-spacing:-0.5px;">
      Bienvenido al newsletter de PixelTEC.
    </h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a1a1aa;">
      Confirmamos tu suscripción de <strong style="color:#e4e4e7;">${escapeHtml(email)}</strong>.
      Te enviaremos contenido pensado para fundadores y equipos que quieren escalar
      con tecnología bien hecha — sin spam.
    </p>

    <div style="background:#0a0a0a;border:1px solid #27272a;border-radius:12px;padding:24px;margin:0 0 28px;">
      <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:2px;">
        Qué vas a recibir
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#e4e4e7;line-height:1.6;">
            <span style="color:#06b6d4;">›</span>&nbsp; Casos reales de automatización e IA aplicada.
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#e4e4e7;line-height:1.6;">
            <span style="color:#06b6d4;">›</span>&nbsp; Patrones de arquitectura web y SaaS que funcionan en producción.
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#e4e4e7;line-height:1.6;">
            <span style="color:#06b6d4;">›</span>&nbsp; Lecciones operativas para crecer sin romper el negocio.
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#e4e4e7;line-height:1.6;">
            <span style="color:#06b6d4;">›</span>&nbsp; Una entrega cada 2&ndash;3 semanas. Cero relleno.
          </td>
        </tr>
      </table>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="https://pixeltec.mx/blog"
             style="display:inline-block;background:#06b6d4;color:#000000;font-weight:700;font-size:14px;text-decoration:none;padding:13px 32px;border-radius:10px;">
            Leer el blog mientras llega →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:32px 0 0;font-size:12px;color:#52525b;text-align:center;line-height:1.6;">
      ¿No fuiste tú? Solo ignora este correo y no te volveremos a escribir.<br/>
      ¿No quieres recibir más correos?
      <a href="${escapeHtml(unsubscribeUrl)}" style="color:#a1a1aa;text-decoration:underline;">Date de baja aquí</a>
      &mdash; un clic, sin preguntas.
    </p>
  `;

  return clientLayout({
    title: 'Bienvenido al newsletter de PixelTEC',
    subtitle: 'Newsletter · Suscripción confirmada',
    body,
  });
}
