'use server';
import type { PortalActionResult, PipelineContext } from '@/lib/action-types';

import { z } from 'zod';
import { getContentEnhancementSuggestions as genAIFunction, ContentEnhancementInput, ContentEnhancementOutput } from '@/ai/flows/content-enhancement-suggestions';
import { getStrategicSuggestions, type StrategicAdvisorInput, type StrategicAdvisorOutput } from '@/ai/flows/strategic-advisor';
import { getGlobalStrategicInsights, type GlobalStrategicInsightsInput, type GlobalStrategicInsightsOutput } from '@/ai/flows/global-strategic-advisor';
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
import { getServerFirestore } from '@/lib/firebase-server';
import { generateAccessCode, generateSlug, type PortalSession } from '@/lib/portal';
import {
  createPortalSession,
  clearPortalSession as clearPortalSessionCookie,
} from '@/lib/portal/session-server';
import { requirePortalSession, PortalAuthError } from '@/lib/portal/auth-guard';
import { logSecurityEvent } from '@/lib/portal/security-log';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, addDoc, collection,
  query, where, limit, orderBy, Timestamp, serverTimestamp,
} from 'firebase/firestore';

const contactSchema = z.object({
  name: z.string().min(2, 'Tu nombre debe tener al menos 2 caracteres.'),
  email: z.string().email('Ingresa un correo electrónico válido.'),
  empresa: z.string().optional(),
  message: z.string().min(10, 'Tu mensaje debe tener al menos 10 caracteres.'),
});

type ContactFormState = {
  message: string;
  errors?: {
    name?: string[];
    email?: string[];
    empresa?: string[];
    message?: string[];
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
    empresa: formData.get('empresa'),
    message: formData.get('message'),
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

type AIEnhancerState = {
    success: boolean;
    data?: ContentEnhancementOutput;
    error?: string;
}

export async function getEnhancementSuggestions(input: ContentEnhancementInput): Promise<AIEnhancerState> {
    if (!input.content || input.content.trim().length < 50) {
        return { success: false, error: 'Please provide at least 50 characters of content to analyze.' };
    }
    
    try {
        const result = await genAIFunction(input);
        return { success: true, data: result };
    } catch (error) {
        console.error('AI content enhancement failed:', error);
        return { success: false, error: 'Failed to get suggestions. The AI service may be temporarily unavailable.' };
    }
}

export async function sendTelegramNotification(message: string): Promise<{ success: boolean; error?: string }> {
  const token = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

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

type AIAdvisorState = {
    success: boolean;
    data?: StrategicAdvisorOutput;
    error?: string;
}

export async function getAIAdvisorSuggestions(input: StrategicAdvisorInput): Promise<AIAdvisorState> {
    if (!input.notes && !input.tasks) {
        return { success: false, error: 'No hay suficiente contexto para analizar. Añade tareas o notas.' };
    }
    
    try {
        const result = await getStrategicSuggestions(input);
        return { success: true, data: result };
    } catch (error) {
        console.error('AI strategic advisor failed:', error);
        return { success: false, error: 'No se pudieron obtener las sugerencias. El servicio de IA podría no estar disponible.' };
    }
}

type AIGlobalAdvisorState = {
    success: boolean;
    data?: GlobalStrategicInsightsOutput;
    error?: string;
}

export async function getGlobalAIInsights(input: GlobalStrategicInsightsInput): Promise<AIGlobalAdvisorState> {
    if (!input.allNotes || input.allNotes.trim().length === 0) {
        return { success: false, error: 'No hay notas para analizar.' };
    }

    try {
        const result = await getGlobalStrategicInsights(input);
        return { success: true, data: result };
    } catch (error) {
        console.error('Global AI strategic advisor failed:', error);
        return { success: false, error: 'No se pudieron obtener los insights. El servicio de IA podría no estar disponible.' };
    }
}

// ─── AI Pipeline Server Actions ─────────────────────────��─────────────────────


type PipelineInput = {
  title: string;
  description: string;
  module: 'clients' | 'projects' | 'tasks' | 'pipeline' | 'finance' | 'support' | 'analytics' | 'auth' | 'global';
  requestedBy: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
};

export async function runFeaturePipelineAction(input: PipelineInput) {
  const { runFeaturePipeline } = await import('@/ai/orchestrators/feature-pipeline');
  return runFeaturePipeline(input);
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
    const db = getServerFirestore();
    const q = query(collection(db, 'clients'), where('slug', '==', slug.trim()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return { success: false, error: 'Portal no encontrado.' };
    const d = snap.docs[0].data();
    return { success: true, data: { companyName: d.companyName, contactEmail: d.contactEmail ?? '' } };
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
    // ── IP-based rate limit ────────────────────────────────────────────────
    const headersList = await headers();
    const rawIp = headersList.get('x-forwarded-for')?.split(',')[0].trim()
               ?? headersList.get('x-real-ip')
               ?? 'unknown';
    const safeIp = rawIp.replace(/[^a-zA-Z0-9.\-]/g, '_').slice(0, 64);

    const db = getServerFirestore();
    const ipRef = doc(db, 'portalRateLimit', safeIp);
    const ipSnap = await getDoc(ipRef);
    if (ipSnap.exists()) {
      const ipData = ipSnap.data();
      const windowStart = ipData.windowStartedAt?.toDate?.() as Date | undefined;
      if (windowStart && Date.now() - windowStart.getTime() < IP_WINDOW_MS) {
        if ((ipData.count ?? 0) >= IP_MAX_REQUESTS) {
          await logSecurityEvent({ type: 'otp-rate-limit-ip', slug, reason: 'IP exceeded 10 req/hour' });
          return { success: false, error: 'Demasiadas solicitudes. Inténtalo más tarde.' };
        }
        await updateDoc(ipRef, { count: (ipData.count ?? 0) + 1 });
      } else {
        await setDoc(ipRef, { count: 1, windowStartedAt: serverTimestamp() });
      }
    } else {
      await setDoc(ipRef, { count: 1, windowStartedAt: serverTimestamp() });
    }

    // ── Slug lookup ────────────────────────────────────────────────────────
    const q = query(collection(db, 'clients'), where('slug', '==', slug.trim()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return { success: false, error: 'Portal no encontrado.' };

    const clientDoc = snap.docs[0];
    const data = clientDoc.data();

    // Per-slug rate limit
    const lastRequest = data.lastCodeRequestAt?.toDate?.() as Date | undefined;
    if (lastRequest && Date.now() - lastRequest.getTime() < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastRequest.getTime())) / 1000);
      return { success: false, error: `Espera ${waitSec}s antes de solicitar otro código.` };
    }

    const code = generateAccessCode();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + CODE_TTL_MS));

    await updateDoc(clientDoc.ref, {
      accessCode: code,
      accessCodeExpiresAt: expiresAt,
      lastCodeRequestAt: serverTimestamp(),
    });

    // Send via Resend
    const email = data.contactEmail as string | undefined;
    if (email) {
      const portalUrl = `${APP_URL}/${slug}`;
      const html = renderClientAccessEmail({
        clientName:  data.contactName ?? data.companyName,
        companyName: data.companyName,
        code,
        portalUrl,
        expiresIn: '10 minutos',
      });
      await sendEmail(email, `🔐 Tu código de acceso — PixelTEC`, html).catch(console.error);
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
    const db = getServerFirestore();
    const q = query(collection(db, 'clients'), where('slug', '==', slug.trim()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return { success: false, error: 'Portal no encontrado.' };

    const clientDoc = snap.docs[0];
    const data = clientDoc.data();

    if (!data.accessCode || data.accessCode !== trimmedCode) {
      await logSecurityEvent({ type: 'otp-invalid-code', slug });
      return { success: false, error: 'Código incorrecto.' };
    }

    const expiresAt = data.accessCodeExpiresAt?.toDate?.() as Date | undefined;
    if (!expiresAt || expiresAt < new Date()) {
      await logSecurityEvent({ type: 'otp-expired-code', slug });
      return { success: false, error: 'El código expiró. Solicita uno nuevo.' };
    }

    // Invalidate code after use (one-time)
    await updateDoc(clientDoc.ref, {
      accessCode: null,
      accessCodeExpiresAt: null,
    });

    // Issue server-side session cookie
    await createPortalSession(clientDoc.id, slug);

    return {
      success: true,
      data: {
        clientId:     clientDoc.id,
        slug,
        companyName:  data.companyName ?? '',
        status:       data.status ?? 'Activo',
        services:     data.services ?? [],
        taskProgress: data.taskProgress ?? { total: 0, completed: 0, percentage: 0 },
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

    const db = getServerFirestore();
    const [clientSnap, updatesSnap, projectsSnap] = await Promise.all([
      getDoc(doc(db, 'clients', clientId)),
      getDocs(query(collection(db, 'clients', clientId, 'updates'), orderBy('createdAt', 'desc'), limit(20))),
      getDocs(query(collection(db, 'clients', clientId, 'projects'), orderBy('name', 'asc'), limit(10))),
    ]);

    if (!clientSnap.exists()) return { success: false, error: 'Cliente no encontrado.' };

    const clientData = clientSnap.data();

    const updates = updatesSnap.docs.map(d => {
      const u = d.data();
      return {
        id:        d.id,
        text:      u.text ?? '',
        imageUrl:  u.imageUrl ?? undefined,
        createdAt: u.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        createdBy: u.createdBy ?? 'PixelTEC',
      };
    });

    const projects = projectsSnap.docs.map(d => ({
      id:     d.id,
      name:   d.data().name ?? '',
      status: d.data().status ?? '',
    }));

    return {
      success: true,
      data: {
        clientId,
        slug:         session.slug,
        companyName:  clientData.companyName ?? '',
        status:       clientData.status ?? 'Activo',
        services:     clientData.services ?? [],
        updates,
        projects,
        taskProgress: clientData.taskProgress ?? { total: 0, completed: 0, percentage: 0 },
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
    const db = getServerFirestore();
    const slug = generateSlug(companyName);
    await updateDoc(doc(db, 'clients', clientId), { slug });
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
    const db = getServerFirestore();
    const ref = await addDoc(collection(db, 'clients', clientId, 'updates'), {
      ...parsed.data,
      imageUrl: parsed.data.imageUrl || null,
      createdAt: serverTimestamp(),
    });
    return { success: true, data: { id: ref.id } };
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
    const db = getServerFirestore();
    const clientSnap = await getDoc(doc(db, 'clients', clientId));
    if (!clientSnap.exists()) return { success: false, error: 'Cliente no encontrado.' };
    const d = clientSnap.data();
    if (!d.contactEmail) return { success: false, error: 'El cliente no tiene email registrado.' };

    const html = renderProjectUpdateEmail({
      clientName:  d.contactName ?? d.companyName,
      companyName: d.companyName,
      updateText:  update.text,
      author:      update.createdBy,
      portalUrl:   `${APP_URL}/${d.slug ?? clientId}`,
      imageUrl:    update.imageUrl,
    });

    return sendEmail(d.contactEmail, `✦ Nueva actualización — ${d.companyName}`, html);
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
    const db = getServerFirestore();
    const clientSnap = await getDoc(doc(db, 'clients', clientId.trim()));

    // Unified rejection: don't reveal whether the clientId exists in Firestore
    if (!clientSnap.exists() || clientSnap.data().slug !== slug.trim()) {
      if (clientSnap.exists()) {
        await logSecurityEvent({
          type:         'migration-slug-mismatch',
          slug:         slug.trim(),
          resolvedSlug: clientSnap.data().slug ?? null,
        });
      }
      return { success: false, error: 'Sesión inválida.' };
    }

    await createPortalSession(clientId.trim(), slug.trim());
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
