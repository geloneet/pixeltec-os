/**
 * @fileoverview PixelTEC OS — Centralized Email Service
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
import { renderNewsletterWelcomeEmail, type NewsletterWelcomeEmailProps } from '@/emails/NewsletterWelcomeEmail';
import { renderProposalEmail, type ProposalEmailProps } from '@/emails/ProposalEmail';

// ── Resend client ──────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? 'PixelTEC <onboarding@resend.dev>';
const TEAM_EMAIL = process.env.PIXELTEC_TEAM_EMAIL ?? 'equipo@pixeltec.mx';

// ── Result type ────────────────────────────────────────────────────────────────

export interface EmailResult {
  success: boolean;
  id?: string;
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
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[email] Sent "${subject}" → ${to} (id: ${data?.id})${attachments?.length ? ` +${attachments.length} adjunto(s)` : ""}`);
    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email] Unexpected error:', message);
    return { success: false, error: message };
  }
}

// ── Domain-specific senders ────────────────────────────────────────────────────

/** Sent to the client's contact email when they are added to the system. */
export async function sendWelcomeEmail(props: WelcomeEmailProps & { email: string }): Promise<EmailResult> {
  const { email, ...templateProps } = props;
  const html = renderWelcomeEmail(templateProps);
  return sendEmail(email, `Bienvenido a PixelTEC, ${props.clientName}`, html);
}

/** Sent to the internal team when a transaction is marked as "Pagado". */
export async function sendInvoiceEmail(props: InvoiceEmailProps): Promise<EmailResult> {
  const html = renderInvoiceEmail(props);
  return sendEmail(
    TEAM_EMAIL,
    `💰 Pago recibido · ${props.clientName} — ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(props.amount)}`,
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
        PixelTEC OS puede enviar correos transaccionales.
      </p>
      <p style="margin:0;font-size:12px;color:#a1a1aa;">
        Enviado el ${new Date().toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' })}
      </p>
    </div>
  </div>
</body>
</html>`;
  return sendEmail(to, '✅ Test de integración — PixelTEC OS', html);
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

/** Sent to a staff member who requests a password reset on /login. */
export async function sendPasswordResetEmail(
  props: PasswordResetEmailProps & { email: string }
): Promise<EmailResult> {
  const { email, ...templateProps } = props;
  const html = renderPasswordResetEmail(templateProps);
  return sendEmail(email, 'Restablece tu contraseña — PixelTEC OS', html);
}

/** Sent to a visitor who subscribes to the newsletter. */
export async function sendNewsletterWelcome(
  props: NewsletterWelcomeEmailProps
): Promise<EmailResult> {
  const html = renderNewsletterWelcomeEmail(props);
  return sendEmail(props.email, 'Bienvenido al newsletter de PixelTEC', html);
}

/** Sent to the CLIENT when an invoice is marked "enviada" — distinct from sendInvoiceEmail (internal team notification on payment). */
export async function sendInvoiceToClient(
  clientEmail: string,
  clientName: string,
  invoiceNumber: string,
  pdfBuffer: Buffer,
): Promise<EmailResult> {
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#000;padding:28px 32px;"><p style="margin:0;font-size:20px;font-weight:700;color:#fff;">Pixel<span style="color:#06b6d4;">TEC</span></p></div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#09090b;">Tu factura ${invoiceNumber}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b;">Hola ${clientName}, adjuntamos tu factura. Cualquier duda, responde este correo.</p>
    </div>
  </div>
</body></html>`;
  return sendEmail(clientEmail, `Factura ${invoiceNumber} — PixelTEC`, html, [
    { filename: `${invoiceNumber}.pdf`, content: pdfBuffer },
  ]);
}
