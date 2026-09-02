/**
 * @fileoverview Pixeltec.mx — Centralized Email Service
 *
 * All email sending goes through this module.
 * Call these functions ONLY from Server Actions or API Routes — never from client code.
 *
 * Required env vars:
 *   RESEND_API_KEY       — Resend API key (https://resend.com/api-keys)
 *   RESEND_FROM_EMAIL    — Sender address (e.g. "PixelTEC <noreply@pixeltec.mx>")
 *   PIXELTEC_TEAM_EMAIL  — Internal team inbox for notifications
 */

import { Resend } from 'resend';
import { renderWelcomeEmail, type WelcomeEmailProps } from '@/emails/WelcomeEmail';
import { renderInvoiceEmail, type InvoiceEmailProps } from '@/emails/InvoiceEmail';
import { renderTaskAssignedEmail, type TaskAssignedEmailProps } from '@/emails/TaskAssignedEmail';
import { renderSupportTicketEmail, type SupportTicketEmailProps } from '@/emails/SupportTicketEmail';
import { renderContactConfirmationEmail, type ContactConfirmationEmailProps } from '@/emails/ContactConfirmationEmail';
import { renderContactNotificationEmail, type ContactNotificationEmailProps } from '@/emails/ContactNotificationEmail';
import { renderDiagnosticNotificationEmail, type DiagnosticNotificationEmailProps } from '@/emails/DiagnosticNotificationEmail';
import { renderPasswordResetEmail, type PasswordResetEmailProps } from '@/emails/PasswordResetEmail';
import { renderPasswordChangedEmail, type PasswordChangedEmailProps } from '@/emails/PasswordChangedEmail';
import { renderUserInvitationEmail, type UserInvitationEmailProps } from '@/emails/UserInvitationEmail';
import { renderNewsletterWelcomeEmail, type NewsletterWelcomeEmailProps } from '@/emails/NewsletterWelcomeEmail';
import { renderProposalEmail, type ProposalEmailProps } from '@/emails/ProposalEmail';
import { renderProposalDecisionEmail, type ProposalDecisionEmailProps } from '@/emails/ProposalDecisionEmail';

// ── Resend client ──────────────────────────────────────────────────────────────

import { assertEmailEgressAllowed, EgressBlockedError } from "@/lib/egress-guard";

// Instanciado perezosamente (no al importar el módulo): `contracts.ts` e
// `invoices.ts` ahora importan `email.ts` para el envío al cliente (C3/C4,
// ADR-0040), y una importación transitiva sin RESEND_API_KEY en el entorno
// (tests, scripts) no debe tumbar el módulo entero solo por ser importado.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'PixelTEC <onboarding@resend.dev>';
const TEAM_EMAIL = process.env.PIXELTEC_TEAM_EMAIL ?? 'equipo@pixeltec.mx';

// ── Result type ────────────────────────────────────────────────────────────────

export interface EmailResult {
  success: boolean;
  id?: string;
  /**
   * Código estable, jamás texto libre del proveedor (E0f-3b). Este valor se
   * persiste tal cual en `leads.email_delivery_error` y en
   * `system_alerts.context`, y cruza rutas HTTP — por eso el contrato es un
   * código y no un mensaje: `email_egress_blocked` (código de
   * `EgressBlockedError`), `email_provider_failed` (Resend respondió con
   * error) o `email_unknown_failure` (excepción inesperada).
   */
  error?: string;
}

// ── Core send function ─────────────────────────────────────────────────────────

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  attachments?: EmailAttachment[]
): Promise<EmailResult> {
  // Fail-closed antes de tocar Resend. `sendEmail` solo expone `to`; si en el
  // futuro admite CC o BCC deben pasarse aquí también, porque la política exige
  // que TODOS los destinatarios estén permitidos para que el envío proceda.
  try {
    assertEmailEgressAllowed({ to });
  } catch (err) {
    if (err instanceof EgressBlockedError) {
      console.error(`[email] bloqueado por política de egress: ${err.reason}`);
      return { success: false, error: err.code };
    }
    throw err;
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    });

    if (error) {
      // El objeto de error de Resend trae su `message` crudo (dominios, cuerpo
      // de la respuesta): al log solo va el `name` del error, y al contrato el
      // código estable.
      console.error('[email] Resend error:', error.name);
      return { success: false, error: 'email_provider_failed' };
    }

    console.log(`[email] Sent "${subject}" → ${to} (id: ${data?.id})`);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[email] Unexpected error:', err instanceof Error ? err.name : typeof err);
    return { success: false, error: 'email_unknown_failure' };
  }
}

// ── Domain-specific senders ────────────────────────────────────────────────────

/** Sent to the client's contact email when they are added to the system. */
export async function sendWelcomeEmail(props: WelcomeEmailProps & { email: string }): Promise<EmailResult> {
  const { email, ...templateProps } = props;
  const html = renderWelcomeEmail(templateProps);
  return sendEmail(email, `Bienvenido a PixelTEC, ${props.clientName}`, html);
}

/**
 * Envío del contrato firmado al cliente (C3, ADR-0040-adyacente) — PDF
 * adjunto vía `EmailAttachment`. Hasta ahora el único camino del cliente al
 * contrato era el portal (requiere `portalAccessEnabled`); este correo no
 * depende de eso.
 */
export async function sendContractSignedEmail(props: {
  email: string;
  clientName: string;
  contractTitle: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}): Promise<EmailResult> {
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#000;padding:28px 32px;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">Pixel<span style="color:#06b6d4;">TEC</span></p>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#09090b;">Tu contrato está firmado</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b;">
        Hola ${props.clientName}, adjuntamos el PDF de <strong>${props.contractTitle}</strong>
        ya firmado por nuestro equipo. Consérvalo para tus registros.
      </p>
      <p style="margin:0;font-size:12px;color:#a1a1aa;">PixelTEC — pixeltec.mx</p>
    </div>
  </div>
</body>
</html>`;
  return sendEmail(
    props.email,
    `Contrato firmado — ${props.contractTitle}`,
    html,
    [{ filename: props.pdfFilename, content: props.pdfBuffer }],
  );
}

/**
 * Entrega de la factura al CLIENTE (C4, ADR-0040) — distinto de
 * `sendInvoiceEmail` de abajo, que es un aviso INTERNO al equipo. El PDF va
 * adjunto vía `EmailAttachment`.
 */
export async function sendInvoiceToClientEmail(props: {
  email: string;
  clientName: string;
  invoiceNumber: string;
  total: number;
  /** Moneda real de la factura (MXN/USD) — antes se formateaba siempre como
   *  MXN sin importar la moneda real de la transacción. Opcional para no
   *  romper llamadas existentes; cae a 'MXN' (comportamiento histórico). */
  currency?: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}): Promise<EmailResult> {
  const formattedTotal = new Intl.NumberFormat("es-MX", { style: "currency", currency: props.currency ?? "MXN" }).format(props.total);
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#000;padding:28px 32px;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">Pixel<span style="color:#06b6d4;">TEC</span></p>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#09090b;">Tu factura ${props.invoiceNumber}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b;">
        Hola ${props.clientName}, adjuntamos tu factura por
        <strong>${formattedTotal}</strong>. Consérvala para tus registros.
      </p>
      <p style="margin:0;font-size:12px;color:#a1a1aa;">PixelTEC — pixeltec.mx</p>
    </div>
  </div>
</body>
</html>`;
  return sendEmail(
    props.email,
    `Factura ${props.invoiceNumber} — PixelTEC`,
    html,
    [{ filename: props.pdfFilename, content: props.pdfBuffer }],
  );
}

/** Sent to the internal team when a transaction is marked as "Pagado". */
export async function sendInvoiceEmail(props: InvoiceEmailProps): Promise<EmailResult> {
  const html = renderInvoiceEmail(props);
  return sendEmail(
    TEAM_EMAIL,
    `💰 Pago recibido · ${props.clientName} — ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: props.currency ?? 'MXN' }).format(props.amount)}`,
    html
  );
}

/** Sent to the internal team when a new task is created. */
export async function sendTaskNotification(props: TaskAssignedEmailProps): Promise<EmailResult> {
  const html = renderTaskAssignedEmail(props);
  return sendEmail(TEAM_EMAIL, `📋 Nueva tarea: ${props.taskTitle}`, html);
}

/** Sent to the client when a proposal's public link is shared with them. */
export async function sendProposalAccessEmail(props: ProposalEmailProps & { email: string }): Promise<EmailResult> {
  const { email, ...templateProps } = props;
  const html = renderProposalEmail(templateProps);
  return sendEmail(email, 'Tu propuesta de PixelTEC está lista', html);
}

/** Sent to the internal team when a new support ticket is opened. */
export async function sendSupportTicketNotification(props: SupportTicketEmailProps): Promise<EmailResult> {
  const html = renderSupportTicketEmail(props);
  const urgencyPrefix = props.prioridad === 'Alta' ? '🔴' : props.prioridad === 'Media' ? '🟡' : '🔵';
  return sendEmail(
    TEAM_EMAIL,
    `${urgencyPrefix} Ticket ${props.ticketId} · ${props.cliente} — ${props.prioridad}`,
    html
  );
}

/** Sends a test email to verify the integration is working. */
export async function sendTestEmail(to: string): Promise<EmailResult> {
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#000;padding:28px 32px;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">Pixel<span style="color:#06b6d4;">TEC</span></p>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#09090b;">✅ Email de Prueba</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b;">
        La integración con Resend está funcionando correctamente.
        Pixeltec.mx puede enviar correos transaccionales.
      </p>
      <p style="margin:0;font-size:12px;color:#a1a1aa;">
        Enviado el ${new Date().toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' })}
      </p>
    </div>
  </div>
</body>
</html>`;
  return sendEmail(to, '✅ Test de integración — Pixeltec.mx', html);
}

// ── Public website senders ─────────────────────────────────────────────────────

/** Sent to the visitor who submits the public contact form. */
export async function sendContactConfirmation(
  props: ContactConfirmationEmailProps & { email: string }
): Promise<EmailResult> {
  const { email, ...templateProps } = props;
  const html = renderContactConfirmationEmail(templateProps);
  return sendEmail(email, 'Recibimos tu mensaje — PixelTEC', html);
}

/** Sent to the internal team when the public contact form is submitted. */
export async function sendContactNotification(
  props: ContactNotificationEmailProps
): Promise<EmailResult> {
  const html = renderContactNotificationEmail(props);
  const subject = `✦ Nuevo contacto web — ${props.name}${props.empresa ? ` (${props.empresa})` : ''}`;
  return sendEmail(TEAM_EMAIL, subject, html);
}

/** Sent to the internal team when a visitor completes the Diagnóstico Inteligente wizard. */
export async function sendDiagnosticNotification(
  props: DiagnosticNotificationEmailProps
): Promise<EmailResult> {
  const html = renderDiagnosticNotificationEmail(props);
  const subject = `🧭 Nuevo Diagnóstico — ${props.name}${props.empresa ? ` (${props.empresa})` : ''} — ${props.score}%`;
  return sendEmail(TEAM_EMAIL, subject, html);
}

/** Aviso interno cuando un cliente decide una propuesta en /p/[token]. */
export async function sendProposalDecisionEmail(
  props: ProposalDecisionEmailProps & { subject: string }
): Promise<EmailResult> {
  const { subject, ...templateProps } = props;
  const html = renderProposalDecisionEmail(templateProps);
  return sendEmail(TEAM_EMAIL, subject, html);
}

/** Sent to a staff member who requests a password reset on /login. */
export async function sendPasswordResetEmail(
  props: PasswordResetEmailProps & { email: string }
): Promise<EmailResult> {
  const { email, ...templateProps } = props;
  const html = renderPasswordResetEmail(templateProps);
  return sendEmail(email, 'Restablece tu contraseña — Pixeltec.mx', html);
}

/**
 * Invitación a un nuevo miembro del equipo interno (C-PR5, Sistema →
 * Usuarios y acceso). Mismo egress guard fail-closed que el resto: pasa por
 * `sendEmail`, y sin `EGRESS_EMAIL_MODE` no sale nada.
 */
export async function sendUserInvitationEmail(
  props: UserInvitationEmailProps & { email: string }
): Promise<EmailResult> {
  const { email, ...templateProps } = props;
  const html = renderUserInvitationEmail(templateProps);
  return sendEmail(email, 'Te invitaron a Pixeltec.mx', html);
}

/**
 * Aviso de seguridad tras un cambio de contraseña exitoso desde /perfil
 * (C-PR2). Mismo egress guard fail-closed que el resto: pasa por `sendEmail`,
 * y sin `EGRESS_EMAIL_MODE` no sale nada.
 */
export async function sendPasswordChangedEmail(
  props: PasswordChangedEmailProps & { email: string }
): Promise<EmailResult> {
  const { email, ...templateProps } = props;
  const html = renderPasswordChangedEmail(templateProps);
  return sendEmail(email, 'Tu contraseña de Pixeltec.mx cambió', html);
}

/** Sent to a visitor who subscribes to the newsletter. */
export async function sendNewsletterWelcome(
  props: NewsletterWelcomeEmailProps
): Promise<EmailResult> {
  const html = renderNewsletterWelcomeEmail(props);
  return sendEmail(props.email, 'Bienvenido al newsletter de PixelTEC', html);
}
