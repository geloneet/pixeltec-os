import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { quotes, clients } from '@/lib/db/schema';
import type { QuoteItem } from './money';

/**
 * Lecturas de cotizaciones (WO-2026-00101). Proyección explícita: la vista
 * pública no puede arrastrar por accidente campos que no le tocan.
 */

export interface QuoteRecord {
  id: string;
  clientId: string;
  folio: string;
  title: string;
  items: QuoteItem[];
  taxEnabled: boolean;
  notes: string;
  validUntil: string | null;
  status: string;
  publicToken: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Sanea el jsonb: una fila corrupta no puede tumbar la pantalla. */
function toItems(raw: unknown): QuoteItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map((i) => ({
      description: typeof i.description === 'string' ? i.description : '',
      quantity: Number.isFinite(i.quantity) ? Number(i.quantity) : 0,
      unitPriceCents: Number.isInteger(i.unitPriceCents) ? Number(i.unitPriceCents) : 0,
    }));
}

type QuoteRow = typeof quotes.$inferSelect;

function toRecord(row: QuoteRow): QuoteRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    folio: row.folio,
    title: row.title,
    items: toItems(row.items),
    taxEnabled: row.taxEnabled,
    notes: row.notes,
    validUntil: row.validUntil ? row.validUntil.toISOString() : null,
    status: row.status,
    publicToken: row.publicToken,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Cotizaciones de un cliente, de la más reciente a la más antigua. */
export async function listQuotesForClient(clientId: string): Promise<QuoteRecord[]> {
  const rows = await db.select().from(quotes).where(eq(quotes.clientId, clientId)).orderBy(desc(quotes.createdAt));
  return rows.map(toRecord);
}

export async function getQuoteById(id: string): Promise<QuoteRecord | null> {
  const rows = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
}

/** Para la vista pública: la cotización más el nombre del cliente. */
export async function getQuoteByToken(
  token: string,
): Promise<(QuoteRecord & { clientName: string }) | null> {
  const rows = await db
    .select({ quote: quotes, clientName: clients.name })
    .from(quotes)
    .innerJoin(clients, eq(clients.id, quotes.clientId))
    .where(eq(quotes.publicToken, token))
    .limit(1);
  if (!rows[0]) return null;
  return { ...toRecord(rows[0].quote), clientName: rows[0].clientName };
}

/** Folios ya usados — alimenta `nextFolio`. */
export async function listFolios(): Promise<string[]> {
  const rows = await db.select({ folio: quotes.folio }).from(quotes);
  return rows.map((r) => r.folio);
}

/** Datos del cliente que necesita la cotización (destinatarios y encabezado). */
export async function getQuoteClient(
  clientId: string,
): Promise<{ id: string; name: string; email: string | null; phone: string | null; whatsapp: string | null } | null> {
  const rows = await db
    .select({ id: clients.id, name: clients.name, email: clients.email, phone: clients.phone, whatsapp: clients.whatsapp })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  return rows[0] ?? null;
}
