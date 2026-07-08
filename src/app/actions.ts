'use server';
import type { PortalActionResult } from '@/lib/action-types';

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
  sendNewsletterWelcome,
  type EmailResult,
} from '@/lib/email';
import { assertEmailEnv } from '@/lib/email-env-guard';
import { enforceRateLimit, formatRetryAfter } from '@/lib/rate-limit';
import { createLead, updateLeadEmailDelivery } from '@/lib/leads-repo';
import { subscribeOrReactivate, normalizeEmail } from '@/lib/newsletter-repo';
import { logSystemAlert } from '@/lib/system-alerts';
import { hashIp } from '@/lib/privacy';
import type { WelcomeEmailProps } from '@/emails/WelcomeEmail';
import type { InvoiceEmailProps } from '@/emails/InvoiceEmail';
import type { TaskAssignedEmailProps } from '@/emails/TaskAssignedEmail';
import type { SupportTicketEmailProps } from '@/emails/SupportTicketEmail';
import { renderClientAccessEmail } from '@/emails/ClientAccessEmail';
import { renderProjectUpdateEmail } from '@/emails/ProjectUpdateEmail';
import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { desc, asc, eq } from 'drizzle-orm';
import { db as pgDb } from '@/lib/db';
import { clients as clientsTable, clientPortalUpdates, clientPortalProjects } from '@/lib/db/schema';
import { findPortalClientBySlug, resolvePortalClient, portalClientPublicId } from '@/lib/portal/pg';
import { generateAccessCode, generateSlug, type PortalSession } from '@/lib/portal';
import {
  createPortalSession,
  clearPortalSession as clearPortalSessionCookie,
} from '@/lib/portal/session-server';
import { requirePortalSession, PortalAuthError } from '@/lib/portal/auth-guard';
import { logSecurityEvent } from '@/lib/portal/security-log';

/**
 * El flujo de portal corría antes sobre el SDK de cliente de Firebase SIN
 * autenticar (`getServerFirestore`), lo que hacía que las reglas de
 * Firestore fueran la única barrera real — y esa misma config pública está
 * embebida en el bundle del navegador. Migrado a Admin SDK: estas server
 * actions ahora tienen su propia autorización (sesión de portal / server-side)
 * en vez de depender de qué tan permisivas sean las reglas.
 */

/** Hash del código OTP — nunca se guarda en texto plano en Firestore. */
function hashAccessCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/** Comparación en tiempo constante de dos hashes hex del mismo largo (sha256 → 64 chars). */
function accessCodeHashMatches(storedHash: string, providedCode: string): boolean {
  const providedHash = hashAccessCode(providedCode);
  const a = Buffer.from(storedHash, 'hex');
  const b = Buffer.from(providedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

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

export async function sendTelegramNotification(message: string): Promise<{ success: boolean; error?: string }> {
  // Sin prefijo NEXT_PUBLIC_: este server action corre solo en el servidor, y un
  // token de bot no debe arriesgarse a inlinearse en el bundle del navegador.
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('Telegram Bot Token o Chat ID no están configurados en las variables de entorno.');
    return { success: false, error: 'Credenciales de Telegram no configuradas.' };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
      cache: 'no-store',
    });

    const result = await response.json();

    if (!result.ok) {
      console.error('Error de la API de Telegram:', result.description);
      return { success: false, error: result.description };
    }

    return { success: true };
  } catch (error) {
    console.error('Fallo al enviar la notificación de Telegram:', error);
    if (error instanceof Error) {
        return { success: false, error: `Error de red: ${error.message}` };
    }
    return { success: false, error: 'Fallo al enviar la notificación por un error desconocido.' };
  }
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

// ─── Portal Server Actions ─────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9002';
const CODE_TTL_MS = 10 * 60 * 1000;    // 10 minutes per OTP
const RATE_LIMIT_MS = 60 * 1000;        // 60 s between requests (per slug)
const IP_MAX_REQUESTS = 10;             // max OTP requests per IP per hour
const IP_WINDOW_MS = 60 * 60 * 1000;   // 1 hour window


/** Check if a client slug exists. Returns company name for display if found. */
export async function checkPortalSlugAction(
  slug: string
): Promise<PortalActionResult<{ companyName: string; contactEmail: string }>> {
  if (!slug?.trim()) return { success: false, error: 'Slug inválido.' };
  try {
    const row = await findPortalClientBySlug(slug);
    if (!row) return { success: false, error: 'Portal no encontrado.' };
    return { success: true, data: { companyName: row.name, contactEmail: row.email ?? '' } };
  } catch (err) {
    console.error('[portal] checkSlug error:', err);
    return { success: false, error: 'Error al verificar el portal.' };
  }
}

/** Generate a new 6-digit code and optionally send it by email. */
export async function requestPortalCodeAction(
  slug: string
): Promise<PortalActionResult<{ maskedEmail: string }>> {
  if (!slug?.trim()) return { success: false, error: 'Slug inválido.' };
  try {
    // ── IP-based rate limit (rate_limit de Postgres — antes colección
    // `portalRateLimit` propia en Firestore) ───────────────────────────────
    const headersList = await headers();
    const rawIp = headersList.get('x-forwarded-for')?.split(',')[0].trim()
               ?? headersList.get('x-real-ip')
               ?? 'unknown';
    const rl = await enforceRateLimit({
      ip: rawIp,
      bucket: 'portal_otp',
      max: IP_MAX_REQUESTS,
      windowMs: IP_WINDOW_MS,
    });
    if (!rl.allowed) {
      await logSecurityEvent({ type: 'otp-rate-limit-ip', slug, reason: 'IP exceeded 10 req/hour' });
      return { success: false, error: 'Demasiadas solicitudes. Inténtalo más tarde.' };
    }

    // ── Slug lookup ────────────────────────────────────────────────────────
    const row = await findPortalClientBySlug(slug);
    if (!row) return { success: false, error: 'Portal no encontrado.' };

    // Per-slug rate limit
    const lastRequest = row.lastCodeRequestAt ?? undefined;
    if (lastRequest && Date.now() - lastRequest.getTime() < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastRequest.getTime())) / 1000);
      return { success: false, error: `Espera ${waitSec}s antes de solicitar otro código.` };
    }

    const code = generateAccessCode();

    await pgDb
      .update(clientsTable)
      .set({
        // El código nunca se guarda en texto plano — un leak de la tabla
        // `clients` no expone el OTP vigente.
        accessCodeHash: hashAccessCode(code),
        accessCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
        lastCodeRequestAt: new Date(),
      })
      .where(eq(clientsTable.id, row.id));

    // Send via Resend
    const email = row.email ?? undefined;
    if (email) {
      const portalUrl = `${APP_URL}/${slug}`;
      const html = renderClientAccessEmail({
        clientName:  row.contactName ?? row.name,
        companyName: row.name,
        code,
        portalUrl,
        expiresIn: '10 minutos',
      });
      const emailResult = await sendEmail(email, `🔐 Tu código de acceso — PixelTEC`, html);
      if (!emailResult.success) {
        // `sendEmail` nunca rechaza (retorna {success:false}) — antes se ignoraba
        // el resultado y se le decía al usuario "código enviado" aunque el envío
        // hubiera fallado, mientras el rate-limit bloqueaba el reintento 60s.
        console.error('[portal] requestCode: fallo enviando email de OTP', emailResult.error);
        return { success: false, error: 'No se pudo enviar el código. Intenta de nuevo en unos minutos.' };
      }
    }

    // Mask email for display: abc***@domain.com
    const maskedEmail = email
      ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, _b, c) => `${a}***${c}`)
      : 'tu correo registrado';

    return { success: true, data: { maskedEmail } };
  } catch (err) {
    console.error('[portal] requestCode error:', err);
    return { success: false, error: 'Error al generar el código.' };
  }
}

/** Validate a portal access code. Returns safe client session data on success. */
export async function verifyPortalCodeAction(
  slug: string,
  code: string
): Promise<PortalActionResult<Omit<PortalSession, 'validatedAt'>>> {
  const trimmedCode = code.trim().replace(/\D/g, '');
  if (trimmedCode.length !== 6) return { success: false, error: 'El código debe tener 6 dígitos.' };

  try {
    const row = await findPortalClientBySlug(slug);
    if (!row) return { success: false, error: 'Portal no encontrado.' };

    if (!row.accessCodeHash || !accessCodeHashMatches(row.accessCodeHash, trimmedCode)) {
      await logSecurityEvent({ type: 'otp-invalid-code', slug });
      return { success: false, error: 'Código incorrecto.' };
    }

    if (!row.accessCodeExpiresAt || row.accessCodeExpiresAt < new Date()) {
      await logSecurityEvent({ type: 'otp-expired-code', slug });
      return { success: false, error: 'El código expiró. Solicita uno nuevo.' };
    }

    // Invalidate code after use (one-time)
    await pgDb
      .update(clientsTable)
      .set({ accessCodeHash: null, accessCodeExpiresAt: null })
      .where(eq(clientsTable.id, row.id));

    // Issue server-side session cookie
    const publicId = portalClientPublicId(row);
    await createPortalSession(publicId, slug);

    return {
      success: true,
      data: {
        clientId:     publicId,
        slug,
        companyName:  row.name,
        status:       row.status ?? 'Activo',
        services:     row.services ?? [],
        taskProgress: (row.taskProgress as { total: number; completed: number; percentage: number } | null) ?? { total: 0, completed: 0, percentage: 0 },
      },
    };
  } catch (err) {
    console.error('[portal] verifyCode error:', err);
    return { success: false, error: 'Error al validar el código.' };
  }
}

/**
 * Fetch portal dashboard data for an authenticated client.
 * Receives the public slug — clientId is derived exclusively from the signed cookie.
 */
export async function getPortalDashboardAction(slug: string): Promise<
  PortalActionResult<{
    clientId:     string;
    slug:         string;
    companyName:  string;
    status:       string;
    services:     string[];
    updates:      { id: string; text: string; imageUrl?: string; createdAt: string; createdBy: string }[];
    projects:     { id: string; name: string; status: string }[];
    taskProgress: { total: number; completed: number; percentage: number };
  }>
> {
  try {
    const session = await requirePortalSession(slug);
    const { clientId } = session;

    const row = await resolvePortalClient(clientId);
    if (!row) return { success: false, error: 'Cliente no encontrado.' };

    const [updateRows, projectRows] = await Promise.all([
      pgDb
        .select()
        .from(clientPortalUpdates)
        .where(eq(clientPortalUpdates.clientId, row.id))
        .orderBy(desc(clientPortalUpdates.createdAt))
        .limit(20),
      pgDb
        .select()
        .from(clientPortalProjects)
        .where(eq(clientPortalProjects.clientId, row.id))
        .orderBy(asc(clientPortalProjects.name))
        .limit(10),
    ]);

    const updates = updateRows.map(u => ({
      id:        u.firestoreId ?? u.id,
      text:      u.text,
      imageUrl:  u.imageUrl ?? undefined,
      createdAt: u.createdAt.toISOString(),
      createdBy: u.createdBy || 'PixelTEC',
    }));

    const projects = projectRows.map(p => ({
      id:     p.firestoreId ?? p.id,
      name:   p.name,
      status: p.status,
    }));

    return {
      success: true,
      data: {
        clientId,
        slug:         session.slug,
        companyName:  row.name,
        status:       row.status ?? 'Activo',
        services:     row.services ?? [],
        updates,
        projects,
        taskProgress: (row.taskProgress as { total: number; completed: number; percentage: number } | null) ?? { total: 0, completed: 0, percentage: 0 },
      },
    };
  } catch (err) {
    if (err instanceof PortalAuthError) {
      return { success: false, error: 'Sesión inválida o expirada.', code: err.reason };
    }
    console.error('[portal] getDashboard error:', err);
    return { success: false, error: 'Error al cargar el portal.' };
  }
}

/** Admin: generate or regenerate portal slug + access code for a client. */
export async function generateClientSlugAction(
  clientId: string,
  companyName: string
): Promise<PortalActionResult<{ slug: string }>> {
  try {
    const row = await resolvePortalClient(clientId);
    if (!row) return { success: false, error: 'Cliente no encontrado.' };
    const slug = generateSlug(companyName);
    await pgDb.update(clientsTable).set({ slug }).where(eq(clientsTable.id, row.id));
    return { success: true, data: { slug } };
  } catch (err) {
    console.error('[portal] generateSlug error:', err);
    return { success: false, error: 'No se pudo generar el slug.' };
  }
}

/** Admin: add a client update (text + optional image) to the updates subcollection. */
export async function addClientUpdateAction(
  clientId: string,
  update: { text: string; imageUrl?: string; createdBy: string }
): Promise<PortalActionResult<{ id: string }>> {
  const schema = z.object({
    text:      z.string().min(1).max(2000),
    imageUrl:  z.string().url().optional().or(z.literal('')),
    createdBy: z.string().min(1),
  });
  const parsed = schema.safeParse(update);
  if (!parsed.success) return { success: false, error: 'Datos inválidos.' };

  try {
    const row = await resolvePortalClient(clientId);
    if (!row) return { success: false, error: 'Cliente no encontrado.' };
    const [inserted] = await pgDb
      .insert(clientPortalUpdates)
      .values({
        clientId: row.id,
        text: parsed.data.text,
        imageUrl: parsed.data.imageUrl || null,
        createdBy: parsed.data.createdBy,
      })
      .returning({ id: clientPortalUpdates.id });
    return { success: true, data: { id: inserted.id } };
  } catch (err) {
    console.error('[portal] addUpdate error:', err);
    return { success: false, error: 'No se pudo guardar la actualización.' };
  }
}

/** Admin: send project update notification email to client. */
export async function sendUpdateEmailAction(
  clientId: string,
  update: { text: string; imageUrl?: string; createdBy: string }
): Promise<EmailResult> {
  try {
    const row = await resolvePortalClient(clientId);
    if (!row) return { success: false, error: 'Cliente no encontrado.' };
    if (!row.email) return { success: false, error: 'El cliente no tiene email registrado.' };

    const html = renderProjectUpdateEmail({
      clientName:  row.contactName ?? row.name,
      companyName: row.name,
      updateText:  update.text,
      author:      update.createdBy,
      portalUrl:   `${APP_URL}/${row.slug ?? clientId}`,
      imageUrl:    update.imageUrl,
    });

    return sendEmail(row.email, `✦ Nueva actualización — ${row.name}`, html);
  } catch (err) {
    console.error('[portal] sendUpdateEmail error:', err);
    return { success: false, error: String(err) };
  }
}

// ─── Migration & Session Management ───────────────────────────────────────────

/**
 * 7-day migration bridge: validates that the legacy sessionStorage clientId actually
 * belongs to the claimed slug, then issues a __portal_session cookie.
 * Called once per client during the migration window.
 */
export async function migratePortalSessionAction(
  slug: string,
  clientId: string,
): Promise<PortalActionResult<null>> {
  if (!slug?.trim() || !clientId?.trim()) {
    return { success: false, error: 'Sesión inválida.' };
  }
  try {
    const row = await resolvePortalClient(clientId);

    // Unified rejection: don't reveal whether the clientId exists
    if (!row || row.slug !== slug.trim()) {
      if (row) {
        await logSecurityEvent({
          type:         'migration-slug-mismatch',
          slug:         slug.trim(),
          resolvedSlug: row.slug ?? undefined,
        });
      }
      return { success: false, error: 'Sesión inválida.' };
    }

    await createPortalSession(portalClientPublicId(row), slug.trim());
    return { success: true, data: null };
  } catch (err) {
    console.error('[portal] migrateSession error:', err);
    return { success: false, error: 'Error al migrar la sesión.' };
  }
}

/** Clears the __portal_session httpOnly cookie (called from client sign-out). */
export async function clearPortalSessionAction(): Promise<void> {
  await clearPortalSessionCookie();
}
