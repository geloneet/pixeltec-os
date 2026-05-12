/**
 * leads repository — Admin SDK only.
 *
 * The `leads` collection is the source of truth for inbound demand
 * (contact form + newsletter). Writing happens BEFORE Resend so a leak
 * in email delivery never costs a high-ticket lead.
 *
 * firestore.rules locks the collection to Admin SDK; treat any client-side
 * read attempt as a bug.
 */

import { getAdminFirestore } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export type LeadSource = 'contact_form' | 'newsletter';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'lost';
export type EmailDeliveryStatus = 'pending' | 'sent' | 'failed';

export interface CreateLeadInput {
  source: LeadSource;
  email: string;
  name?: string;
  message?: string;
  userAgent?: string;
  ip?: string;
}

/** Persist a new lead. Returns the auto-generated doc id. */
export async function createLead(input: CreateLeadInput): Promise<string> {
  const db = getAdminFirestore();
  const email = input.email.toLowerCase().trim();

  const payload: Record<string, unknown> = {
    source: input.source,
    email,
    status: 'new' as LeadStatus,
    emailDeliveryStatus: 'pending' as EmailDeliveryStatus,
    createdAt: FieldValue.serverTimestamp(),
    consentTimestamp: FieldValue.serverTimestamp(),
  };

  if (input.name) payload.name = input.name;
  if (input.message) payload.message = input.message;
  if (input.userAgent) payload.userAgent = input.userAgent;
  if (input.ip) payload.ip = input.ip;

  const ref = await db.collection('leads').add(payload);
  return ref.id;
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
    const update: Record<string, unknown> = {
      emailDeliveryStatus: status,
      emailDeliveryAt: FieldValue.serverTimestamp(),
    };
    if (error) update.emailDeliveryError = error.slice(0, 500);

    await getAdminFirestore().collection('leads').doc(leadId).update(update);
  } catch (err) {
    console.error('[leads] update delivery status failed', leadId, err);
  }
}
