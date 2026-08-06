/**
 * Password-changed notice — sent to a staff/team member (`users` table,
 * NextAuth login) right after their password is changed from /perfil.
 * Security notice: if the recipient didn't do it, they must reset ASAP.
 */

import { clientLayout, escapeHtml } from './shared';

export interface PasswordChangedEmailProps {
  name: string;
  /** Momento del cambio — se formatea es-MX (America/Mexico_City). */
  changedAt: Date;
  /** URL absoluta a /login para el CTA de "restablécela ahora". */
  loginUrl: string;
}

export function renderPasswordChangedEmail(props: PasswordChangedEmailProps): string {
  const { name, changedAt, loginUrl } = props;

  const changedAtLabel = changedAt.toLocaleString('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  });

  return clientLayout({
    title: 'Tu contraseña de PixelTEC OS cambió',
    subtitle: 'System OS · Seguridad',
    body: `
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1.5px;">
        Aviso de seguridad
      </p>
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#ffffff;">
        Hola, ${escapeHtml(name)}
      </h1>
      <p style="margin:0 0 32px;font-size:15px;color:#a1a1aa;line-height:1.5;">
        La contrase&ntilde;a de tu cuenta del equipo interno de PixelTEC OS se cambi&oacute; correctamente.
      </p>

      <div style="background:#1c1917;border:1px solid #292524;border-radius:10px;padding:14px 18px;margin-bottom:28px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#78716c;">
          &#128337; Fecha del cambio: <strong style="color:#f5f5f4;">${escapeHtml(changedAtLabel)}</strong>
        </p>
      </div>

      <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.6;text-align:center;">
        Si fuiste t&uacute;, no necesitas hacer nada m&aacute;s.<br/>
        <strong style="color:#f5f5f4;">Si no fuiste t&uacute;, rest&aacute;blecela ahora</strong> desde la pantalla de acceso.
      </p>

      <div style="text-align:center;margin:0 0 28px;">
        <a href="${loginUrl}" style="display:inline-block;background:#06b6d4;color:#000000;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:-0.3px;">
          Restablecer contrase&ntilde;a →
        </a>
      </div>

      <p style="margin:28px 0 0;font-size:12px;color:#52525b;text-align:center;line-height:1.6;">
        Este aviso se env&iacute;a autom&aacute;ticamente cada vez que cambia la contrase&ntilde;a de tu cuenta.<br/>
        <a href="${loginUrl}" style="color:#71717a;word-break:break-all;">${loginUrl}</a>
      </p>`,
  });
}
