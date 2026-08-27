'use server';

/**
 * Server Actions de cotizaciones (WO-2026-00101).
 *
 * Sin IA en ningún punto: la cotización la escribe Miguel.
 *
 * Permisos: crear y editar exigen sesión; **enviar exige rol administrador**,
 * porque un envío sale de la casa y llega a un cliente real. El envío nunca es
 * automático: siempre lo dispara una acción explícita.
 */
import { eq } from 'drizzle-orm';
import { randomUUID, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { quotes } from '@/lib/db/schema';
import { requireUserSession } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth-guards';
import { toPublicFailure } from '@/lib/errors/public-failure';
import type { ActionResult } from '@/lib/blog/schemas';
import { sendEmail } from '@/lib/email';
import { SITE } from '@/lib/site-config';
import {
  RECURRENCES,
  RECURRENCE_TOTAL_LABEL,
  computeBreakdown,
  usableItems,
  validateQuote,
  type QuoteItem,
} from './money';
import {
  CURRENCIES,
  DEFAULT_EXCLUSIONS,
  DEFAULT_PAYMENT_TERMS,
  PAYMENT_TYPES,
  REJECTION_REASONS,
  defaultValidUntil,
  displayStatus,
  firstFollowUp,
  firstInstalment,
  formatAmountWithCode,
  formatDate,
  missingToSend,
  nextFollowUp,
  parsePaymentTerms,
  type PaymentTerms,
} from './terms';
import { createChargeFromQuote, toBillingFrequency } from './billing-bridge';
import { nextFolio } from './folio';
import { buildEmailSubject } from './share';
import { getQuoteById, getQuoteClient, listFolios } from './queries';
import { resolveClientPgId } from '@/lib/documents/pg';
import { renderQuoteEmailHtml } from './email-html';
import { renderQuotePdf } from './pdf';

function fail(err: unknown, code: string, message: string): ActionResult<never> {
  // Un `ZodError` a secas en el log no dice nada: se registra QUÉ campo falló
  // (ruta y motivo, nunca el valor) para poder diagnosticar sin adivinar.
  const detail =
    err instanceof z.ZodError
      ? err.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join(' · ')
      : err instanceof Error
        ? err.name
        : typeof err;
  console.error(`[quotes] ${code}:`, detail);
  return { ok: false, error: toPublicFailure(err, { code, message }).message };
}

const ItemSchema = z.object({
  description: z.string().max(500),
  quantity: z.number().finite().min(0).max(1_000_000),
  unitPriceCents: z.number().int().min(0).max(999_999_999),
  // Ausente ⇒ pago único: las cotizaciones guardadas antes de esta orden no lo
  // traen y deben seguir guardándose sin tocar nada.
  recurrence: z.enum(RECURRENCES).optional(),
});

const SaveQuoteSchema = z.object({
  id: z.string().uuid().optional(),
  // OJO: es el id PÚBLICO del cliente (ADR-0035), no el uuid de Postgres.
  // La pantalla de cliente vive en /clientes/<publicId>. Se resuelve abajo.
  clientId: z.string().min(1).max(64),
  title: z.string().max(200),
  items: z.array(ItemSchema).max(100),
  taxEnabled: z.boolean(),
  notes: z.string().max(5000),
  validUntil: z.string().max(40).nullable(),
  // ── MVP comercial (WO-2026-00104) ────────────────────────────────────────
  currency: z.enum(CURRENCIES),
  problem: z.string().max(4000),
  solution: z.string().max(4000),
  scopeIncluded: z.string().max(4000),
  exclusions: z.string().max(4000),
  estimatedDelivery: z.string().max(200),
  paymentTerms: z.object({ type: z.enum(PAYMENT_TYPES), custom: z.string().max(2000) }),
});
export type SaveQuoteInput = z.infer<typeof SaveQuoteSchema>;

/**
 * La pestaña recarga sus datos llamando a `listQuotesAction`, no por caché de
 * ruta. Se revalida solo `/clientes` — interpolar aquí el id sería mentira: en
 * unos sitios se tiene el id público (el de la URL) y en otros el uuid de
 * Postgres, y la ruta solo existe con el primero.
 */
function revalidateClient(_clientId: string) {
  revalidatePath('/clientes');
}

/** Crea o actualiza una cotización. Devuelve su id. */
export async function saveQuote(input: SaveQuoteInput): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireUserSession();
    if (!session) return { ok: false, error: 'Necesitas iniciar sesión.' };

    const data = SaveQuoteSchema.parse(input);
    const clientPgId = await resolveClientPgId(data.clientId);
    if (!clientPgId) return { ok: false, error: 'No se encontró el cliente.' };

    const items: QuoteItem[] = usableItems(data.items);

    const issues = validateQuote({ title: data.title, items, validUntil: data.validUntil });
    if (issues.length > 0) return { ok: false, error: issues[0].message };

    const validUntil = data.validUntil ? new Date(data.validUntil) : null;

    if (data.id) {
      const existing = await getQuoteById(data.id);
      if (!existing) return { ok: false, error: 'La cotización ya no existe.' };
      await db
        .update(quotes)
        .set({
          title: data.title.trim(),
          items,
          taxEnabled: data.taxEnabled,
          notes: data.notes.trim(),
          validUntil,
          currency: data.currency,
          problem: data.problem.trim(),
          solution: data.solution.trim(),
          scopeIncluded: data.scopeIncluded.trim(),
          exclusions: data.exclusions.trim(),
          estimatedDelivery: data.estimatedDelivery.trim(),
          paymentTerms: data.paymentTerms,
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, data.id));
      revalidateClient(existing.clientId);
      return { ok: true, data: { id: data.id } };
    }

    const id = randomUUID();
    await db.insert(quotes).values({
      id,
      clientId: clientPgId,
      folio: nextFolio(new Date().getFullYear(), await listFolios()),
      title: data.title.trim(),
      items,
      taxEnabled: data.taxEnabled,
      notes: data.notes.trim(),
      // §6: si no la tocó, hoy + 15 días. Nunca se guarda sin vigencia.
      validUntil: validUntil ?? defaultValidUntil(new Date()),
      currency: data.currency,
      problem: data.problem.trim(),
      solution: data.solution.trim(),
      scopeIncluded: data.scopeIncluded.trim(),
      exclusions: data.exclusions.trim() || DEFAULT_EXCLUSIONS,
      estimatedDelivery: data.estimatedDelivery.trim(),
      paymentTerms: data.paymentTerms,
      status: 'borrador',
      publicToken: randomBytes(24).toString('base64url'),
      createdBy: session.userId,
    });
    revalidateClient(data.clientId);
    return { ok: true, data: { id } };
  } catch (err) {
    return fail(err, 'save_quote_failed', 'No se pudo guardar la cotización.');
  }
}

/** Borra una cotización. */
export async function deleteQuote(id: string): Promise<ActionResult> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Borrar una cotización requiere rol administrador.' };

    const existing = await getQuoteById(id);
    if (!existing) return { ok: true };

    await db.delete(quotes).where(eq(quotes.id, id));
    revalidateClient(existing.clientId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'delete_quote_failed', 'No se pudo borrar la cotización.');
  }
}

/**
 * Envía la cotización por correo con el PDF adjunto.
 *
 * Acción explícita de un administrador — nunca se dispara sola. `to` permite
 * corregir el destinatario cuando el correo del cliente está desactualizado.
 */
export async function sendQuoteByEmail(id: string, to?: string): Promise<ActionResult<{ to: string }>> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Enviar una cotización requiere rol administrador.' };

    const quote = await getQuoteById(id);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };

    const client = await getQuoteClient(quote.clientId);
    if (!client) return { ok: false, error: 'El cliente ya no existe.' };

    const recipient = (to ?? client.email ?? '').trim();
    if (!recipient) return { ok: false, error: 'Este cliente no tiene correo. Escribe uno para enviar.' };

    const blocking = missingToSend(quote);
    if (blocking.length > 0) {
      return { ok: false, error: `Antes de enviarla falta ${blocking.join(', ')}.` };
    }

    // El importe que se comunica es el de la inversión inicial: sumarle una
    // mensualidad daría un número que no significa nada.
    const totals = computeBreakdown(quote.items, quote.taxEnabled).oneTime;
    const url = `${SITE.url}/c/${quote.publicToken}`;

    const pdf = await renderQuotePdf({ quote, clientName: client.name });
    const html = renderQuoteEmailHtml({
      clientName: client.name,
      folio: quote.folio,
      title: quote.title,
      total: formatAmountWithCode(totals.totalCents, quote.currency),
      url,
      validUntil: formatDate(quote.validUntil),
    });

    const result = await sendEmail(recipient, buildEmailSubject(quote), html, [
      { filename: `${quote.folio}.pdf`, content: pdf },
    ]);
    if (!result.success) return { ok: false, error: 'El correo no salió. Revisa el destinatario.' };

    const sentAt = new Date();
    await db
      .update(quotes)
      .set({
        status: 'enviada',
        sentAt,
        // §20: el seguimiento se agenda solo al enviar. Sin jobs ni cron.
        nextFollowUpAt: firstFollowUp(sentAt),
        updatedAt: sentAt,
      })
      .where(eq(quotes.id, id));
    revalidateClient(quote.clientId);

    return { ok: true, data: { to: recipient } };
  } catch (err) {
    return fail(err, 'send_quote_failed', 'No se pudo enviar la cotización.');
  }
}

/**
 * Marca la cotización como enviada tras compartirla por WhatsApp.
 *
 * El envío por WhatsApp lo hace Miguel desde su propio WhatsApp (enlace
 * `wa.me`): aquí solo se registra que salió, para que el estado no mienta.
 */
export async function markQuoteShared(id: string): Promise<ActionResult> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const quote = await getQuoteById(id);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };

    const blocking = missingToSend(quote);
    if (blocking.length > 0) {
      return { ok: false, error: `Antes de marcarla enviada falta ${blocking.join(', ')}.` };
    }

    const sentAt = quote.sentAt ? new Date(quote.sentAt) : new Date();
    await db
      .update(quotes)
      .set({ status: 'enviada', sentAt, nextFollowUpAt: firstFollowUp(sentAt), updatedAt: new Date() })
      .where(eq(quotes.id, id));
    revalidateClient(quote.clientId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'mark_shared_failed', 'No se pudo actualizar el estado.');
  }
}

/** Lista para la pestaña del cliente (el workspace es un Client Component). */
export async function listQuotesAction(clientId: string): Promise<ActionResult<{ quotes: unknown[] }>> {
  try {
    const session = await requireUserSession();
    if (!session) return { ok: false, error: 'Necesitas iniciar sesión.' };
    const { listQuotesForClient } = await import('./queries');
    // Igual que al guardar: llega el id público, la tabla usa el uuid.
    const clientPgId = await resolveClientPgId(clientId);
    if (!clientPgId) return { ok: true, data: { quotes: [] } };
    return { ok: true, data: { quotes: await listQuotesForClient(clientPgId) } };
  } catch (err) {
    return fail(err, 'list_quotes_failed', 'No se pudieron cargar las cotizaciones.');
  }
}

// ── Flujo comercial (WO-2026-00104 §21–§23) ─────────────────────────────────

/** Marca la cotización como aceptada y cancela el seguimiento (§21). */
export async function acceptQuote(id: string): Promise<ActionResult> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const quote = await getQuoteById(id);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };
    if (quote.status === 'borrador') {
      return { ok: false, error: 'Primero márcala como enviada.' };
    }

    await db
      .update(quotes)
      .set({
        status: 'aceptada',
        acceptedAt: new Date(),
        // §21: aceptada ⇒ deja de pedir seguimiento.
        nextFollowUpAt: null,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id));
    revalidateClient(quote.clientId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'accept_quote_failed', 'No se pudo marcar como aceptada.');
  }
}

const RejectSchema = z.object({
  id: z.string().uuid(),
  reason: z.enum(REJECTION_REASONS),
  comment: z.string().max(2000),
});

/** Marca la cotización como rechazada y guarda el motivo (§23). */
export async function rejectQuote(input: z.infer<typeof RejectSchema>): Promise<ActionResult> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const data = RejectSchema.parse(input);
    const quote = await getQuoteById(data.id);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };

    await db
      .update(quotes)
      .set({
        status: 'rechazada',
        rejectedAt: new Date(),
        rejection: { reason: data.reason, comment: data.comment.trim() },
        nextFollowUpAt: null,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, data.id));
    revalidateClient(quote.clientId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'reject_quote_failed', 'No se pudo marcar como rechazada.');
  }
}

/** Aplaza el seguimiento siete días (§20). No hay recordatorios automáticos. */
export async function snoozeFollowUp(id: string): Promise<ActionResult<{ nextFollowUpAt: string }>> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const quote = await getQuoteById(id);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };

    const next = nextFollowUp(new Date());
    await db.update(quotes).set({ nextFollowUpAt: next, updatedAt: new Date() }).where(eq(quotes.id, id));
    revalidateClient(quote.clientId);
    return { ok: true, data: { nextFollowUpAt: next.toISOString() } };
  } catch (err) {
    return fail(err, 'snooze_failed', 'No se pudo reprogramar el seguimiento.');
  }
}

/**
 * Crea el cobro de la primera parcialidad (§22).
 *
 * Inserta en `billing_items` desde `billing-bridge.ts`, un archivo nuevo:
 * Finanzas no se modifica. No crea proyectos, tareas ni contratos.
 */
export async function createChargeForQuote(
  id: string,
): Promise<ActionResult<{ concept: string; amount: string; recurrentes: string[] }>> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Crear un cobro requiere rol administrador.' };

    const quote = await getQuoteById(id);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };
    if (quote.status !== 'aceptada') {
      return { ok: false, error: 'Solo se crea el cobro de una cotización aceptada.' };
    }

    const breakdown = computeBreakdown(quote.items, quote.taxEnabled);
    const totals = breakdown.oneTime;
    const instalment = firstInstalment(totals.totalCents, quote.paymentTerms);
    if (!instalment || instalment.amountCents <= 0) {
      return { ok: false, error: 'La cotización no tiene un importe que cobrar.' };
    }

    const concept = `${instalment.label} ${quote.folio}`;
    // `billing_items.due_date` es NOT NULL: se usa la vigencia y, si no la hay, hoy.
    const dueDate = (quote.validUntil ?? new Date().toISOString()).slice(0, 10);

    const created = await createChargeFromQuote({
      clientId: quote.clientId,
      concept,
      amountCents: instalment.amountCents,
      currency: quote.currency,
      dueDate,
      frequency: 'unico',
    });
    if (!created) return { ok: false, error: 'No se pudo crear el cobro.' };

    // Los conceptos recurrentes se dan de alta como cobros recurrentes de
    // verdad: `billing_items.frequency` ya admite mensual, trimestral y anual,
    // así que no hace falta inventar nada. Sin esto, un concepto mensual
    // quedaría cotizado y jamás cobrado.
    const recurrentes: string[] = [];
    for (const grupo of breakdown.recurring) {
      if (grupo.totals.totalCents <= 0) continue;
      const etiqueta = RECURRENCE_TOTAL_LABEL[grupo.recurrence];
      const ok = await createChargeFromQuote({
        clientId: quote.clientId,
        concept: `${etiqueta} ${quote.folio}`,
        amountCents: grupo.totals.totalCents,
        currency: quote.currency,
        dueDate,
        frequency: toBillingFrequency(grupo.recurrence),
      });
      if (ok) recurrentes.push(`${etiqueta}: ${formatAmountWithCode(grupo.totals.totalCents, quote.currency)}`);
    }

    revalidateClient(quote.clientId);
    revalidatePath('/cobros');
    return {
      ok: true,
      data: {
        concept,
        amount: formatAmountWithCode(instalment.amountCents, quote.currency),
        recurrentes,
      },
    };
  } catch (err) {
    return fail(err, 'create_charge_failed', 'No se pudo crear el cobro.');
  }
}

/** Una cotización suelta, para la vista de detalle (§16). */
export async function getQuoteAction(id: string): Promise<ActionResult<{ quote: unknown }>> {
  try {
    const session = await requireUserSession();
    if (!session) return { ok: false, error: 'Necesitas iniciar sesión.' };
    const quote = await getQuoteById(id);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };
    return { ok: true, data: { quote } };
  } catch (err) {
    return fail(err, 'get_quote_failed', 'No se pudo cargar la cotización.');
  }
}
