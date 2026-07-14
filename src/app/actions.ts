'use server';

import { z } from 'zod';
import {
  sendWelcomeEmail,
  sendInvoiceEmail,
  sendTaskNotification,
  sendSupportTicketNotification,
  sendTestEmail,
  sendEmail,
  sendContactConfirmation,
  sendContactNotification,
  sendDiagnosticNotification,
  sendPasswordResetEmail,
  sendNewsletterWelcome,
  type EmailResult,
} from '@/lib/email';
import { assertEmailEnv } from '@/lib/email-env-guard';
import { enforceRateLimit, formatRetryAfter } from '@/lib/rate-limit';
import { createLead, createDiagnosticLead, updateLeadEmailDelivery, markLeadWantsContact } from '@/lib/leads-repo';
import { computeDiagnostic, type DiagnosticAnswers, type DiagnosticResult } from '@/lib/diagnostic/logic';
import { sendWhatsApp } from '@/lib/whatsapp/sender';
import { subscribeOrReactivate, normalizeEmail } from '@/lib/newsletter-repo';
import { logSystemAlert } from '@/lib/system-alerts';
import { hashIp } from '@/lib/privacy';
import type { WelcomeEmailProps } from '@/emails/WelcomeEmail';
import type { InvoiceEmailProps } from '@/emails/InvoiceEmail';
import type { TaskAssignedEmailProps } from '@/emails/TaskAssignedEmail';
import type { SupportTicketEmailProps } from '@/emails/SupportTicketEmail';
import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { db as pgDb } from '@/lib/db';
import { clients as clientsTable, users as usersTable, passwordResetTokens, leads as leadsTable } from '@/lib/db/schema';
import bcrypt from 'bcryptjs';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9002';

const contactSchema = z.object({
  name: z.string().min(2, 'Tu nombre debe tener al menos 2 caracteres.'),
  email: z.string().email('Ingresa un correo electrónico válido.'),
  empresa: z.string().optional(),
  message: z.string().min(10, 'Tu mensaje debe tener al menos 10 caracteres.'),
  consent: z.literal('on', {
    errorMap: () => ({ message: 'Debes aceptar el Aviso de Privacidad para enviar el formulario.' }),
  }),
});

type ContactFormState = {
  message: string;
  errors?: {
    name?: string[];
    email?: string[];
    empresa?: string[];
    message?: string[];
    consent?: string[];
  };
  isSuccess: boolean;
};

const CONTACT_RATE_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 } as const; // 3/hour
const NEWSLETTER_RATE_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 } as const;

/** Best-effort silent success used to defeat honeypot-tripping bots. */
const HONEYPOT_SILENT_SUCCESS: ContactFormState = {
  message: '¡Gracias! Te enviamos una confirmación a tu correo. Te respondemos en menos de 24 h.',
  isSuccess: true,
};

async function getRequestContext(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0].trim() ??
    h.get('x-real-ip') ??
    'unknown';
  const userAgent = h.get('user-agent') ?? '';
  return { ip, userAgent };
}

export async function submitContactForm(
  prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  // 1) Honeypot — silent success, NO persistence, NO email.
  const honeypot = (formData.get('website') ?? '').toString();
  if (honeypot.trim() !== '') {
    console.warn('[contact] honeypot tripped, dropping submission');
    return HONEYPOT_SILENT_SUCCESS;
  }

  // 2) Validate
  const validatedFields = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    // The landing-page <ContactSection /> doesn't render this field;
    // FormData.get returns null when absent, which Zod's .optional()
    // rejects ("Expected string, received null"). Coerce to undefined.
    empresa: formData.get('empresa') ?? undefined,
    message: formData.get('message'),
    consent: formData.get('consent'),
  });

  if (!validatedFields.success) {
    return {
      message: 'Por favor corrige los errores señalados.',
      errors: validatedFields.error.flatten().fieldErrors,
      isSuccess: false,
    };
  }

  const { name, email, empresa, message } = validatedFields.data;

  // 3) Env guard — visible failure, leads cannot proceed without Resend wired up.
  const envCheck = await assertEmailEnv('contact_form');
  if (!envCheck.ok) {
    return {
      message:
        'Servicio de correo no disponible temporalmente. Escríbenos directamente a contacto@pixeltec.mx mientras lo resolvemos.',
      isSuccess: false,
    };
  }

  // 4) Rate limit
  const { ip, userAgent } = await getRequestContext();
  const rl = await enforceRateLimit({
    ip,
    bucket: 'contact_form',
    max: CONTACT_RATE_LIMIT.max,
    windowMs: CONTACT_RATE_LIMIT.windowMs,
  });
  if (!rl.allowed) {
    return {
      message: `Demasiados intentos. Intenta en ${formatRetryAfter(rl.retryAfterSec)}.`,
      isSuccess: false,
    };
  }

  // 5) Persist FIRST — never lose a high-ticket lead to an email outage.
  let leadId: string | null = null;
  try {
    leadId = await createLead({
      source: 'contact_form',
      email,
      name,
      message,
      userAgent,
      ipHash: hashIp(ip),
    });
  } catch (err) {
    console.error('[contact] createLead failed:', err);
    await logSystemAlert({
      severity: 'critical',
      source: 'contact_form',
      message: 'createLead failed — visitor saw a generic error',
      context: { error: String(err) },
    });
    return {
      message: 'Ocurrió un error inesperado. Inténtalo de nuevo en unos minutos.',
      isSuccess: false,
    };
  }

  // 6) Send notifications in parallel; the lead is already safe.
  const submittedAt = new Date().toLocaleString('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  });

  const [teamResult, userResult] = await Promise.all([
    sendContactNotification({ name, email, message, empresa, submittedAt }),
    sendContactConfirmation({ email, name, message, empresa }),
  ]);

  const teamOk = teamResult.success;
  const userOk = userResult.success;

  if (teamOk && userOk) {
    await updateLeadEmailDelivery(leadId, 'sent');
  } else {
    const errMsg = [
      !teamOk ? `team: ${teamResult.error}` : null,
      !userOk ? `user: ${userResult.error}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
    await updateLeadEmailDelivery(leadId, 'failed', errMsg);
    await logSystemAlert({
      severity: !teamOk ? 'critical' : 'warning',
      source: 'contact_form',
      message: `Resend delivery failed (lead ${leadId})`,
      context: { teamOk, userOk, errMsg, leadId },
    });
  }

  // 7) Visitor-facing response: surface failure only when team did NOT get the message.
  if (!teamOk) {
    return {
      message:
        'Guardamos tu mensaje pero el correo al equipo falló. Si es urgente, escríbenos a contacto@pixeltec.mx — ya estamos al tanto.',
      isSuccess: false,
    };
  }

  return {
    message: '¡Gracias! Te enviamos una confirmación a tu correo. Te respondemos en menos de 24 h.',
    isSuccess: true,
  };
}

// ─── Diagnóstico Inteligente ────────────────────────────────────────────────

const diagnosticSchema = z.object({
  name: z.string().min(2, 'Tu nombre debe tener al menos 2 caracteres.'),
  email: z.string().email('Ingresa un correo electrónico válido.'),
  phone: z.string().optional(),
  empresa: z.string().optional(),
  companyType: z.string().min(1, 'Selecciona el tipo de empresa.'),
  problems: z.array(z.string()).min(1, 'Selecciona al menos un problema.'),
  companySize: z.string().min(1, 'Selecciona el tamaño de tu empresa.'),
  priority: z.string().min(1, 'Selecciona tu prioridad.'),
  consent: z.literal('on', {
    errorMap: () => ({ message: 'Debes aceptar el Aviso de Privacidad para continuar.' }),
  }),
});

export type DiagnosticFormInput = {
  name: string;
  email: string;
  phone?: string;
  empresa?: string;
  companyType: string;
  problems: string[];
  companySize: string;
  priority: string;
  consent: string;
  /** Honeypot — debe llegar vacío. */
  website?: string;
};

export type SubmitDiagnosticState =
  | { ok: true; leadId: string; result: DiagnosticResult }
  | { ok: false; message: string; errors?: Record<string, string[] | undefined> };

const DIAGNOSTIC_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 } as const; // 5/hour

/** Público — llamado desde el wizard de Diagnóstico Inteligente al terminar el último paso. */
export async function submitDiagnostic(input: DiagnosticFormInput): Promise<SubmitDiagnosticState> {
  // 1) Honeypot — silent-ish failure, NO persistence, NO notificaciones.
  if ((input.website ?? '').trim() !== '') {
    console.warn('[diagnostic] honeypot tripped, dropping submission');
    // El wizard ya mostró el resultado (calculado en cliente) antes de este
    // submit — no hace falta devolver un resultado real, un bot no lo verá.
    return { ok: false, message: 'No se pudo procesar tu solicitud.' };
  }

  // 2) Validate
  const validated = diagnosticSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: 'Por favor corrige los errores señalados.',
      errors: validated.error.flatten().fieldErrors,
    };
  }
  const { name, email, phone, empresa, companyType, problems, companySize, priority } = validated.data;

  // 3) Env guard
  const envCheck = await assertEmailEnv('diagnostic');
  if (!envCheck.ok) {
    return {
      ok: false,
      message: 'Servicio no disponible temporalmente. Escríbenos a contacto@pixeltec.mx mientras lo resolvemos.',
    };
  }

  // 4) Rate limit
  const { ip, userAgent } = await getRequestContext();
  const rl = await enforceRateLimit({
    ip,
    bucket: 'diagnostic',
    max: DIAGNOSTIC_RATE_LIMIT.max,
    windowMs: DIAGNOSTIC_RATE_LIMIT.windowMs,
  });
  if (!rl.allowed) {
    return { ok: false, message: `Demasiados intentos. Intenta en ${formatRetryAfter(rl.retryAfterSec)}.` };
  }

  // 5) Recompute the result server-side — never trust a client-sent score.
  const answers: DiagnosticAnswers = {
    companyType,
    problems,
    companySize,
    priority,
    name,
    email,
    phone,
    empresa,
  };
  const result = computeDiagnostic(answers);

  // 6) Persist FIRST — never lose a lead to an email/WhatsApp outage.
  let leadId: string | null = null;
  try {
    leadId = await createDiagnosticLead({
      email,
      name,
      phone,
      empresa,
      industry: companyType,
      companySize,
      problems,
      priority,
      suggestedServices: result.recommendedServices,
      score: result.score,
      answers: { ...answers, result },
      userAgent,
      ipHash: hashIp(ip),
    });
  } catch (err) {
    console.error('[diagnostic] createDiagnosticLead failed:', err);
    await logSystemAlert({
      severity: 'critical',
      source: 'diagnostic',
      message: 'createDiagnosticLead failed — visitor saw a generic error',
      context: { error: String(err) },
    });
    return { ok: false, message: 'Ocurrió un error inesperado. Inténtalo de nuevo en unos minutos.' };
  }

  // 7) Notify the team — email + WhatsApp, in parallel. Neither can lose the
  // lead: it's already safe in Postgres by this point.
  const submittedAt = new Date().toLocaleString('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  });

  const [emailResult, whatsappResult] = await Promise.all([
    sendDiagnosticNotification({
      name,
      email,
      phone,
      empresa,
      industry: companyType,
      companySize,
      problems,
      priority,
      score: result.score,
      recommendedServices: result.recommendedServices,
      timeline: result.timeline,
      submittedAt,
    }),
    // sendWhatsApp() THROWS on failure (unlike sendEmail) — a missing
    // allowlist entry or expired token must never take down an already
    // persisted lead, so this is wrapped locally.
    sendWhatsApp(
      `🧭 Nuevo Diagnóstico — ${name}${empresa ? ` (${empresa})` : ''}\n` +
        `Industria: ${companyType} · Tamaño: ${companySize}\n` +
        `Madurez: ${result.score}% · Prioridad: ${priority}\n` +
        `Servicios: ${result.recommendedServices.join(', ')}\n` +
        `Contacto: ${email}${phone ? ` / ${phone}` : ''}`
    ).catch((err) => {
      console.error('[diagnostic] sendWhatsApp failed:', err);
      return null;
    }),
  ]);

  const emailOk = emailResult.success;
  await updateLeadEmailDelivery(leadId, emailOk ? 'sent' : 'failed', emailOk ? undefined : emailResult.error);

  if (!emailOk || !whatsappResult) {
    await logSystemAlert({
      severity: emailOk ? 'warning' : 'critical',
      source: 'diagnostic',
      message: `Notificación de diagnóstico incompleta (lead ${leadId})`,
      context: { emailOk, whatsappOk: !!whatsappResult, leadId },
    });
  }

  // El visitante siempre ve su resultado — la notificación interna es
  // best-effort y nunca bloquea la experiencia del wizard.
  return { ok: true, leadId, result };
}

const DIAGNOSTIC_CONTACT_RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 }; // 10/hora por IP

/**
 * Público — botón "Quiero que me contacten" en la pantalla de resultado del
 * diagnóstico. El lead ya existe (creado por submitDiagnostic); esto solo
 * marca la señal fuerte de intención + avisa al equipo de inmediato.
 */
export async function requestDiagnosticContactAction(leadId: string): Promise<{ ok: boolean }> {
  if (!leadId) return { ok: false };

  const { ip } = await getRequestContext();
  const rl = await enforceRateLimit({
    ip,
    bucket: 'diagnostic_contact',
    max: DIAGNOSTIC_CONTACT_RATE_LIMIT.max,
    windowMs: DIAGNOSTIC_CONTACT_RATE_LIMIT.windowMs,
  });
  if (!rl.allowed) return { ok: false };

  try {
    const [lead] = await pgDb.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
    if (!lead || lead.source !== 'diagnostic') return { ok: false };

    await markLeadWantsContact(leadId);

    // HOTFIX (code review 2026-07-09): antes se hacía `await` sobre esto,
    // contradiciendo el propio comentario de "best-effort, nunca bloquea" —
    // el visitante esperaba el round-trip completo a la API de WhatsApp. Sin
    // `await`: la función retorna en cuanto el lead queda marcado, y el
    // envío sigue en segundo plano (proceso Node.js de larga duración en
    // este VPS, no serverless — la promesa no se corta al responder).
    sendWhatsApp(
      `🔥 Lead pidió que lo contacten — ${lead.name ?? 'sin nombre'}${lead.empresa ? ` (${lead.empresa})` : ''}\n` +
        `Score: ${lead.score ?? '—'}% · Contacto: ${lead.email}${lead.phone ? ` / ${lead.phone}` : ''}`
    ).catch((err) => console.error('[diagnostic] wantsContact sendWhatsApp failed:', err));

    return { ok: true };
  } catch (err) {
    console.error('[diagnostic] requestDiagnosticContactAction error:', err);
    return { ok: false };
  }
}

// ─── Password Reset (equipo interno / tabla `users`, login NextAuth) ───────

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
const RESET_REQUEST_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 }; // 5/hora por IP
const RESET_CONFIRM_RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 }; // 10/hora por IP

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// SIEMPRE el mismo mensaje exista o no el correo, esté o no rate-limited —
// evita que este formulario público sirva para enumerar correos válidos del
// equipo interno.
const GENERIC_RESET_MESSAGE =
  'Si el correo existe en nuestro sistema, te enviamos instrucciones para restablecer tu contraseña.';

/** Público — /login (modo dev) → "¿Olvidaste tu contraseña?". */
export async function requestPasswordResetAction(email: string): Promise<{ message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !/\S+@\S+\.\S+/.test(normalizedEmail)) {
    return { message: GENERIC_RESET_MESSAGE };
  }

  const { ip } = await getRequestContext();
  const rl = await enforceRateLimit({
    ip,
    bucket: 'password_reset',
    max: RESET_REQUEST_RATE_LIMIT.max,
    windowMs: RESET_REQUEST_RATE_LIMIT.windowMs,
  });
  if (!rl.allowed) return { message: GENERIC_RESET_MESSAGE };

  try {
    const [user] = await pgDb.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
    if (!user) return { message: GENERIC_RESET_MESSAGE };

    const envCheck = await assertEmailEnv('password_reset');
    if (!envCheck.ok) return { message: GENERIC_RESET_MESSAGE };

    const rawToken = crypto.randomBytes(32).toString('hex');
    await pgDb.insert(passwordResetTokens).values({
      userId: user.id,
      // El token nunca se guarda en texto plano — un leak de esta tabla no
      // permite resetear ninguna cuenta.
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;
    const result = await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetUrl,
      expiresIn: '1 hora',
    });
    if (!result.success) {
      console.error('[password-reset] sendPasswordResetEmail failed:', result.error);
      await logSystemAlert({
        severity: 'warning',
        source: 'password_reset',
        message: `Envío de reset de contraseña falló para ${user.id}`,
        context: { error: result.error },
      });
    }
  } catch (err) {
    console.error('[password-reset] requestPasswordResetAction error:', err);
  }

  return { message: GENERIC_RESET_MESSAGE };
}

export type ResetPasswordResult = { ok: true } | { ok: false; message: string };

/** Público — /reset-password?token=... → nueva contraseña. */
export async function resetPasswordAction(token: string, newPassword: string): Promise<ResetPasswordResult> {
  if (!token) return { ok: false, message: 'Enlace inválido o incompleto.' };
  if (newPassword.length < 8) {
    return { ok: false, message: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  const { ip } = await getRequestContext();
  const rl = await enforceRateLimit({
    ip,
    bucket: 'password_reset_confirm',
    max: RESET_CONFIRM_RATE_LIMIT.max,
    windowMs: RESET_CONFIRM_RATE_LIMIT.windowMs,
  });
  if (!rl.allowed) {
    return { ok: false, message: 'Demasiados intentos. Inténtalo más tarde.' };
  }

  try {
    const tokenHash = hashResetToken(token);
    const [row] = await pgDb
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!row) {
      return { ok: false, message: 'Este enlace ya no es válido o expiró. Solicita uno nuevo.' };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pgDb.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(usersTable.id, row.userId));
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, row.id));
    });

    return { ok: true };
  } catch (err) {
    console.error('[password-reset] resetPasswordAction error:', err);
    return { ok: false, message: 'Ocurrió un error inesperado. Inténtalo de nuevo.' };
  }
}

// ─── Newsletter ───────────────────────────────────────────────────────────────

const newsletterSchema = z.object({
  email: z.string().trim().email('Ingresa un correo electrónico válido.'),
});

/**
 * Subscribe a visitor to the newsletter.
 *
 * Public contract — unary `(email: string)` to match the original handler
 * shape consumed by `<NewsletterSection />`. The honeypot bot-check is
 * the form's responsibility (it knows about its own DOM); this action
 * never sees it. Concerns stay separated.
 */
export async function subscribeToNewsletterAction(
  email: string
): Promise<{ success: boolean; error?: string }> {
  // 1) Validate
  const parsed = newsletterSchema.safeParse({ email });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Correo inválido.' };
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);

  // 2) Env guard
  const envCheck = await assertEmailEnv('newsletter');
  if (!envCheck.ok) {
    return {
      success: false,
      error: 'Servicio de correo no disponible temporalmente. Inténtalo en unos minutos.',
    };
  }

  // 3) Rate limit
  const { ip } = await getRequestContext();
  const rl = await enforceRateLimit({
    ip,
    bucket: 'newsletter',
    max: NEWSLETTER_RATE_LIMIT.max,
    windowMs: NEWSLETTER_RATE_LIMIT.windowMs,
  });
  if (!rl.allowed) {
    return {
      success: false,
      error: `Demasiados intentos. Intenta en ${formatRetryAfter(rl.retryAfterSec)}.`,
    };
  }

  // 4) Dedupe / reactivate
  let outcome: Awaited<ReturnType<typeof subscribeOrReactivate>>;
  try {
    outcome = await subscribeOrReactivate(normalizedEmail, 'homepage');
  } catch (err) {
    console.error('[newsletter] subscribeOrReactivate failed:', err);
    await logSystemAlert({
      severity: 'critical',
      source: 'newsletter',
      message: 'subscribeOrReactivate failed',
      context: { error: String(err), email: normalizedEmail },
    });
    return {
      success: false,
      error: 'No pudimos confirmar tu suscripción. Inténtalo en unos minutos.',
    };
  }

  // 5) Silent success for already-active — never re-spam an existing subscriber.
  if (outcome.alreadyActive) {
    return { success: true };
  }

  // 6) Send welcome (only for fresh subs + reactivations)
  const unsubscribeUrl = `${APP_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(outcome.unsubscribeToken)}`;
  const result = await sendNewsletterWelcome({ email: normalizedEmail, unsubscribeUrl });
  if (!result.success) {
    console.error('[newsletter] welcome email failed:', result.error);
    await logSystemAlert({
      severity: 'warning',
      source: 'newsletter',
      message: 'Welcome email failed — subscriber persisted in Firestore',
      context: { email: normalizedEmail, error: result.error },
    });
    // Subscriber is already in Firestore; show success to keep funnel clean.
    return { success: true };
  }

  // 7) Best-effort team heads-up — never blocks the visitor flow.
  const teamEmail = process.env.PIXELTEC_TEAM_EMAIL;
  if (teamEmail) {
    const label = outcome.reactivated ? 'Reactivación' : 'Nueva suscripción';
    sendEmail(
      teamEmail,
      `✦ ${label} al newsletter — ${normalizedEmail}`,
      `<p style="font-family:-apple-system,sans-serif;font-size:14px;color:#27272a;">${label}: <strong>${normalizedEmail}</strong></p>`
    ).catch(err => console.error('[newsletter] team notify failed:', err));
  }

  return { success: true };
}

// ─── Email Server Actions ─────────────────────��────────────────────────────────

const welcomeEmailSchema = z.object({
  email:       z.string().email(),
  clientName:  z.string().min(1),
  companyName: z.string().min(1),
  services:    z.array(z.string()),
  assignedTo:  z.string(),
});

export async function sendNewClientEmailAction(
  input: WelcomeEmailProps & { email: string }
): Promise<EmailResult> {
  const parsed = welcomeEmailSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Datos de cliente inválidos.' };
  return sendWelcomeEmail(parsed.data);
}

const invoiceEmailSchema = z.object({
  clientName:  z.string().min(1),
  projectName: z.string().min(1),
  amount:      z.number().positive(),
  method:      z.string(),
  type:        z.string(),
  date:        z.string(),
});

export async function sendPaymentEmailAction(input: InvoiceEmailProps): Promise<EmailResult> {
  const parsed = invoiceEmailSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Datos de transacción inválidos.' };
  return sendInvoiceEmail(parsed.data);
}

const taskEmailSchema = z.object({
  taskTitle:   z.string().min(1),
  responsible: z.string(),
  status:      z.string(),
  dueDate:     z.string().optional(),
});

export async function sendTaskEmailAction(input: TaskAssignedEmailProps): Promise<EmailResult> {
  const parsed = taskEmailSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Datos de tarea inválidos.' };
  return sendTaskNotification(parsed.data);
}

const ticketEmailSchema = z.object({
  ticketId:  z.string(),
  cliente:   z.string().min(1),
  problema:  z.string().min(1),
  categoria: z.string(),
  prioridad: z.enum(['Baja', 'Media', 'Alta']),
  createdAt: z.string(),
});

export async function sendTicketEmailAction(input: SupportTicketEmailProps): Promise<EmailResult> {
  const parsed = ticketEmailSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Datos de ticket inválidos.' };
  return sendSupportTicketNotification(parsed.data);
}

const testEmailSchema = z.object({ to: z.string().email() });

export async function sendTestEmailAction(input: { to: string }): Promise<EmailResult> {
  const parsed = testEmailSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Email de destino inválido.' };
  return sendTestEmail(parsed.data.to);
}
