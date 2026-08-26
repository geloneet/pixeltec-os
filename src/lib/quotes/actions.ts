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
import { computeTotals, formatMoney, usableItems, validateQuote, type QuoteItem } from './money';
import { nextFolio } from './folio';
import { buildEmailSubject } from './share';
import { getQuoteById, getQuoteClient, listFolios } from './queries';
import { renderQuoteEmailHtml } from './email-html';
import { renderQuotePdf } from './pdf';

function fail(err: unknown, code: string, message: string): ActionResult<never> {
  console.error(`[quotes] ${code}:`, err instanceof Error ? err.name : typeof err);
  return { ok: false, error: toPublicFailure(err, { code, message }).message };
}

const ItemSchema = z.object({
  description: z.string().max(500),
  quantity: z.number().finite().min(0).max(1_000_000),
  unitPriceCents: z.number().int().min(0).max(999_999_999),
});

const SaveQuoteSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  title: z.string().max(200),
  items: z.array(ItemSchema).max(100),
  taxEnabled: z.boolean(),
  notes: z.string().max(5000),
  validUntil: z.string().max(40).nullable(),
});
export type SaveQuoteInput = z.infer<typeof SaveQuoteSchema>;

function revalidateClient(clientId: string) {
  revalidatePath(`/clientes/${clientId}`);
}

/** Crea o actualiza una cotización. Devuelve su id. */
export async function saveQuote(input: SaveQuoteInput): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireUserSession();
    if (!session) return { ok: false, error: 'Necesitas iniciar sesión.' };

    const data = SaveQuoteSchema.parse(input);
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
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, data.id));
      revalidateClient(existing.clientId);
      return { ok: true, data: { id: data.id } };
    }

    const id = randomUUID();
    await db.insert(quotes).values({
      id,
      clientId: data.clientId,
      folio: nextFolio(new Date().getFullYear(), await listFolios()),
      title: data.title.trim(),
      items,
      taxEnabled: data.taxEnabled,
      notes: data.notes.trim(),
      validUntil,
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

    const totals = computeTotals(quote.items, quote.taxEnabled);
    const url = `${SITE.url}/c/${quote.publicToken}`;

    const pdf = await renderQuotePdf({ quote, clientName: client.name });
    const html = renderQuoteEmailHtml({
      clientName: client.name,
      folio: quote.folio,
      title: quote.title,
      total: formatMoney(totals.totalCents),
      url,
      validUntil: quote.validUntil,
    });

    const result = await sendEmail(recipient, buildEmailSubject(quote), html, [
      { filename: `${quote.folio}.pdf`, content: pdf },
    ]);
    if (!result.success) return { ok: false, error: 'El correo no salió. Revisa el destinatario.' };

    await db
      .update(quotes)
      .set({ status: 'enviada', sentAt: new Date(), updatedAt: new Date() })
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

    await db
      .update(quotes)
      .set({ status: 'enviada', sentAt: quote.sentAt ? new Date(quote.sentAt) : new Date(), updatedAt: new Date() })
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
    return { ok: true, data: { quotes: await listQuotesForClient(clientId) } };
  } catch (err) {
    return fail(err, 'list_quotes_failed', 'No se pudieron cargar las cotizaciones.');
  }
}
