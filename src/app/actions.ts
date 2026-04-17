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
  type EmailResult,
} from '@/lib/email';
import type { WelcomeEmailProps } from '@/emails/WelcomeEmail';
import type { InvoiceEmailProps } from '@/emails/InvoiceEmail';
import type { TaskAssignedEmailProps } from '@/emails/TaskAssignedEmail';
import type { SupportTicketEmailProps } from '@/emails/SupportTicketEmail';
import { renderClientAccessEmail } from '@/emails/ClientAccessEmail';
import { renderProjectUpdateEmail } from '@/emails/ProjectUpdateEmail';
import { getServerFirestore } from '@/lib/firebase-server';
import { generateAccessCode, generateSlug, type PortalSession } from '@/lib/portal';
import {
  doc, getDoc, getDocs, updateDoc, addDoc, collection,
  query, where, limit, orderBy, Timestamp, serverTimestamp,
} from 'firebase/firestore';

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  empresa: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters.'),
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

export async function submitContactForm(
  prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const validatedFields = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    empresa: formData.get('empresa'),
    message: formData.get('message'),
  });

  if (!validatedFields.success) {
    return {
      message: 'Please correct the errors below.',
      errors: validatedFields.error.flatten().fieldErrors,
      isSuccess: false,
    };
  }

  try {
    // In a real application, you would save the data to Firestore here.
    // e.g., await db.collection('contacts').add(validatedFields.data);
    console.log('Form data submitted:', validatedFields.data);

    return {
      message: 'Thank you! Your message has been sent successfully.',
      isSuccess: true,
    };
  } catch (error) {
    console.error('Error submitting form:', error);
    return {
      message: 'An unexpected error occurred. Please try again later.',
      isSuccess: false,
    };
  }
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
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MS = 60 * 1000;    // 60 seconds between requests


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
    const db = getServerFirestore();
    const q = query(collection(db, 'clients'), where('slug', '==', slug.trim()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return { success: false, error: 'Portal no encontrado.' };

    const clientDoc = snap.docs[0];
    const data = clientDoc.data();

    // Rate limit
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
      return { success: false, error: 'Código incorrecto.' };
    }

    const expiresAt = data.accessCodeExpiresAt?.toDate?.() as Date | undefined;
    if (!expiresAt || expiresAt < new Date()) {
      return { success: false, error: 'El código expiró. Solicita uno nuevo.' };
    }

    // Invalidate code after use (one-time)
    await updateDoc(clientDoc.ref, {
      accessCode: null,
      accessCodeExpiresAt: null,
    });

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

/** Fetch portal dashboard data (updates + projects) for an authenticated client. */
export async function getPortalDashboardAction(clientId: string): Promise<
  PortalActionResult<{
    updates:  { id: string; text: string; imageUrl?: string; createdAt: string; createdBy: string }[];
    projects: { id: string; name: string; status: string }[];
    taskProgress: { total: number; completed: number; percentage: number };
  }>
> {
  if (!clientId) return { success: false, error: 'Session inválida.' };
  try {
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
        updates,
        projects,
        taskProgress: clientData.taskProgress ?? { total: 0, completed: 0, percentage: 0 },
      },
    };
  } catch (err) {
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
