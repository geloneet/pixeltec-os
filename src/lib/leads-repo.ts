/**
 * leads repository (Fase 4 — Postgres, antes Firestore `leads`).
 *
 * The `leads` table is the source of truth for inbound demand
 * (contact form + newsletter). Writing happens BEFORE Resend so a leak
 * in email delivery never costs a high-ticket lead.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';

export type LeadSource = 'contact_form' | 'newsletter' | 'diagnostic';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'lost';
export type EmailDeliveryStatus = 'pending' | 'sent' | 'failed';

export interface CreateLeadInput {
  source: LeadSource;
  email: string;
  name?: string;
  message?: string;
  /** Raw UA string. Not classified as PII on its own under our retention policy. */
  userAgent?: string;
  /**
   * Salted sha256 of the caller IP — never the raw address. Compute with
   * `hashIp()` from `@/lib/privacy`. Storing the raw IP violates GDPR posture
   * declared in the aviso de privacidad.
   */
  ipHash?: string;
}

/** Persist a new lead. Returns the generated row id. */
export async function createLead(input: CreateLeadInput): Promise<string> {
  const email = input.email.toLowerCase().trim();

  const [row] = await db
    .insert(leads)
    .values({
      source: input.source,
      email,
      name: input.name ?? null,
      message: input.message ?? null,
      userAgent: input.userAgent ?? null,
      ipHash: input.ipHash ?? null,
      status: 'new',
      emailDeliveryStatus: 'pending',
    })
    .returning({ id: leads.id });
  return row.id;
}

export interface CreateDiagnosticLeadInput {
  email: string;
  name: string;
  phone?: string;
  empresa?: string;
  industry: string;
  companySize: string;
  problems: string[];
  priority: string;
  suggestedServices: string[];
  score: number;
  /** Full wizard answers snapshot — kept for auditing/future re-scoring. */
  answers: Record<string, unknown>;
  userAgent?: string;
  ipHash?: string;
}

/** Persist a new diagnostic-wizard lead. Returns the generated row id. */
export async function createDiagnosticLead(input: CreateDiagnosticLeadInput): Promise<string> {
  const email = input.email.toLowerCase().trim();

  const [row] = await db
    .insert(leads)
    .values({
      source: 'diagnostic',
      email,
      name: input.name,
      phone: input.phone ?? null,
      empresa: input.empresa ?? null,
      industry: input.industry,
      companySize: input.companySize,
      problems: input.problems,
      suggestedServices: input.suggestedServices,
      priority: input.priority,
      score: input.score,
      answers: input.answers,
      userAgent: input.userAgent ?? null,
      ipHash: input.ipHash ?? null,
      status: 'new',
      emailDeliveryStatus: 'pending',
    })
    .returning({ id: leads.id });
  return row.id;
}

/**
 * Marca un lead de diagnóstico con la señal explícita "quiero que me
 * contacten" — el visitante ya vio su resultado y pide seguimiento activo,
 * distinto (más fuerte) que solo haber llenado el formulario inicial.
 */
export async function markLeadWantsContact(leadId: string): Promise<void> {
  await db
    .update(leads)
    .set({ wantsContact: true, wantsContactAt: new Date() })
    .where(eq(leads.id, leadId));
}

/**
 * Record Resend delivery outcome on an existing lead.
 * Best-effort: failures here are logged but never thrown — the lead is
 * already persisted and a human can recover it manually.
 */
export async function updateLeadEmailDelivery(
  leadId: string,
  status: 'sent' | 'failed',
  error?: string
): Promise<void> {
  try {
    await db
      .update(leads)
      .set({
        emailDeliveryStatus: status,
        emailDeliveryAt: new Date(),
        ...(error ? { emailDeliveryError: error.slice(0, 500) } : {}),
      })
      .where(eq(leads.id, leadId));
  } catch (err) {
    console.error('[leads] update delivery status failed', leadId, err);
  }
}
