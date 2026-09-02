/**
 * Invitation email — sent to a new staff/team member (`users` table,
 * status='invited') when an admin invites them from Sistema → Usuarios y
 * acceso (C-PR5). The link carries the RAW token; only its sha256 lives in
 * `user_invitations`.
 */

import { clientLayout, escapeHtml } from './shared';

export interface UserInvitationEmailProps {
  name: string;
  inviteUrl: string;
  expiresIn: string;
}

export function renderUserInvitationEmail(props: UserInvitationEmailProps): string {
  const { name, inviteUrl, expiresIn } = props;

  return clientLayout({
    title: 'Te invitaron a Pixeltec.mx',
    subtitle: 'System OS · Acceso',
    body: `
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1.5px;">
        Invitaci&oacute;n al equipo
      </p>
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#ffffff;">
        Hola, ${escapeHtml(name)}
      </h1>
      <p style="margin:0 0 32px;font-size:15px;color:#a1a1aa;line-height:1.5;">
        Te invitaron a unirte al equipo interno de Pixeltec.mx. Para activar tu
        cuenta, elige tu contrase&ntilde;a desde el siguiente enlace.
      </p>

      <div style="text-align:center;margin:0 0 28px;">
        <a href="${inviteUrl}" style="display:inline-block;background:#06b6d4;color:#000000;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:-0.3px;">
          Activar mi cuenta →
        </a>
      </div>

      <div style="background:#1c1917;border:1px solid #292524;border-radius:10px;padding:14px 18px;margin-bottom:28px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#78716c;">
          &#9201; Este enlace expira en <strong style="color:#f5f5f4;">${escapeHtml(expiresIn)}</strong> y solo puede usarse una vez.
        </p>
      </div>

      <p style="margin:28px 0 0;font-size:12px;color:#52525b;text-align:center;line-height:1.6;">
        Si no esperabas esta invitaci&oacute;n, puedes ignorar este mensaje.<br/>
        <a href="${inviteUrl}" style="color:#71717a;word-break:break-all;">${inviteUrl}</a>
      </p>`,
  });
}
