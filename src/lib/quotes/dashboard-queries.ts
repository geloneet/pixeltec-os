'use server';

/**
 * Cotizaciones — vista dedicada (WO-2026-00132). Antes solo se veían dentro
 * de la pantalla de cada cliente; esta consulta las trae TODAS las del owner
 * autenticado, con su estado derivado (`displayStatus`, misma fuente única
 * que ya usa la pestaña Cotizaciones del workspace de cliente).
 */

import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, quotes } from '@/lib/db/schema';
import { requireOwner } from '@/lib/documents/pg';
import { displayStatus, isCurrency, parsePaymentTerms, type QuoteStatus } from './terms';
import type { QuoteItem } from './money';

export interface DashboardQuoteRow {
  id: string;
  folio: string;
  title: string;
  clientId: string;
  clientName: string;
  status: QuoteStatus;
  validUntil: string | null;
  totalCents: number;
  currency: string;
}

function toItems(raw: unknown): QuoteItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as QuoteItem[];
}

/** Todas las cotizaciones del owner autenticado, con estado derivado. */
export async function listQuotesForOwner(): Promise<DashboardQuoteRow[]> {
  const { ownerId } = await requireOwner();
  const now = new Date();

  const rows = await db
    .select({
      id: quotes.id,
      folio: quotes.folio,
      title: quotes.title,
      clientId: quotes.clientId,
      clientName: clients.name,
      status: quotes.status,
      validUntil: quotes.validUntil,
      items: quotes.items,
      taxEnabled: quotes.taxEnabled,
      currency: quotes.currency,
      problem: quotes.problem,
      solution: quotes.solution,
      scopeIncluded: quotes.scopeIncluded,
      paymentTerms: quotes.paymentTerms,
    })
    .from(quotes)
    .innerJoin(clients, eq(clients.id, quotes.clientId))
    .where(eq(clients.ownerId, ownerId))
    .orderBy(desc(quotes.createdAt));

  return rows.map((r) => {
    const items = toItems(r.items);
    const currency = isCurrency(r.currency) ? r.currency : 'MXN';
    const totalCents = items.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);
    const status = displayStatus(
      {
        title: r.title,
        items,
        validUntil: r.validUntil ? r.validUntil.toISOString() : null,
        problem: r.problem,
        solution: r.solution,
        scopeIncluded: r.scopeIncluded,
        paymentTerms: parsePaymentTerms(r.paymentTerms),
        status: r.status,
      },
      now
    );
    return {
      id: r.id,
      folio: r.folio,
      title: r.title,
      clientId: r.clientId,
      clientName: r.clientName,
      status,
      validUntil: r.validUntil ? r.validUntil.toISOString() : null,
      totalCents,
      currency,
    };
  });
}
