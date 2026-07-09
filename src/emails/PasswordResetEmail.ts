/**
 * Password-reset link email — sent to a staff/team member (`users` table,
 * NextAuth login) when they request "¿Olvidaste tu contraseña?" on /login.
 * Patrón espejo de ClientAccessEmail.ts, pero con un link en vez de un
 * código de dígitos (es un reset de contraseña, no un acceso OTP).
 */

import { clientLayout, escapeHtml } from './shared';

export interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
  expiresIn: string;
}

export function renderPasswordResetEmail(props: PasswordResetEmailProps): string {
  const { name, resetUrl, expiresIn } = props;

  return clientLayout({
    title: 'Restablece tu contraseña — PixelTEC OS',
    subtitle: 'System OS · Acceso',
    body: `
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1.5px;">
        Restablecer contrase&ntilde;a
      </p>
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#ffffff;">
        Hola, ${escapeHtml(name)}
      </h1>
      <p style="margin:0 0 32px;font-size:15px;color:#a1a1aa;line-height:1.5;">
        Recibimos una solicitud para restablecer tu contrase&ntilde;a de acceso al equipo interno de PixelTEC.
      </p>

      <div style="text-align:center;margin:0 0 28px;">
        <a href="${resetUrl}" style="display:inline-block;background:#06b6d4;color:#000000;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:-0.3px;">
          Restablecer contrase&ntilde;a →
        </a>
      </div>

      <div style="background:#1c1917;border:1px solid #292524;border-radius:10px;padding:14px 18px;margin-bottom:28px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#78716c;">
          &#9201; Este enlace expira en <strong style="color:#f5f5f4;">${escapeHtml(expiresIn)}</strong> y solo puede usarse una vez.
        </p>
      </div>

      <p style="margin:28px 0 0;font-size:12px;color:#52525b;text-align:center;line-height:1.6;">
        Si no solicitaste este cambio, puedes ignorar este mensaje — tu contrase&ntilde;a actual sigue siendo v&aacute;lida.<br/>
        <a href="${resetUrl}" style="color:#71717a;word-break:break-all;">${resetUrl}</a>
      </p>`,
  });
}
