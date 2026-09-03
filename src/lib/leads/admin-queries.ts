import { asc, desc, eq, inArray, min, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, leads, sales } from "@/lib/db/schema";
import type { LeadStatus } from "@/lib/leads-repo";

/**
 * Lecturas de la bandeja de leads del admin (WO-2026-00214, A13).
 *
 * `convertedAt` NO se lee de la columna: se DERIVA de la primera venta del
 * cliente vinculado. Guardarlo a mano crearía una segunda verdad sobre cuándo
 * un lead se volvió cliente, y esa verdad se desincronizaría de `sales` en el
 * primer ajuste de fecha. La columna existe en el esquema como caché para el
 * futuro, pero la pantalla muestra siempre el valor derivado.
 */

export interface AdminLeadRow {
  id: string;
  source: string;
  status: LeadStatus;
  email: string;
  name: string | null;
  empresa: string | null;
  message: string | null;
  createdAt: Date;
  qualifiedAt: Date | null;
  /** Derivado de la primera venta del cliente vinculado. */
  convertedAt: Date | null;
  clientId: string | null;
  clientName: string | null;
  sessionId: string | null;
  landingPath: string | null;
  firstContentPath: string | null;
  serviceInterest: string | null;
  attribution: unknown;
}

export interface ClientOption {
  id: string;
  name: string;
}

/** Los leads más recientes primero. `limit` acotado para no traer la tabla entera. */
export async function listLeads(limit = 200): Promise<AdminLeadRow[]> {
  const rows = await db
    .select({
      id: leads.id,
      source: leads.source,
      status: leads.status,
      email: leads.email,
      name: leads.name,
      empresa: leads.empresa,
      message: leads.message,
      createdAt: leads.createdAt,
      qualifiedAt: leads.qualifiedAt,
      clientId: leads.clientId,
      clientName: clients.name,
      sessionId: leads.sessionId,
      landingPath: leads.landingPath,
      firstContentPath: leads.firstContentPath,
      serviceInterest: leads.serviceInterest,
      attribution: leads.attribution,
    })
    .from(leads)
    .leftJoin(clients, eq(leads.clientId, clients.id))
    .orderBy(desc(leads.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));

  // Primera venta por cliente, en una sola consulta para los clientes que
  // realmente aparecen — no una consulta por fila.
  const clientIds = [...new Set(rows.map((r) => r.clientId).filter((id): id is string => Boolean(id)))];
  const firstSale = new Map<string, Date>();
  if (clientIds.length > 0) {
    const saleRows = await db
      .select({ clientId: sales.clientId, firstAt: min(sales.acceptedAt) })
      .from(sales)
      .where(inArray(sales.clientId, clientIds))
      .groupBy(sales.clientId);
    for (const row of saleRows) {
      if (row.firstAt) firstSale.set(row.clientId, row.firstAt);
    }
  }

  return rows.map((row) => ({
    ...row,
    status: row.status as LeadStatus,
    convertedAt: row.clientId ? (firstSale.get(row.clientId) ?? null) : null,
  }));
}

/** Clientes para el selector de vinculación, ordenados por nombre. */
export async function listClientOptions(): Promise<ClientOption[]> {
  return db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .orderBy(asc(clients.name))
    .limit(1000);
}

export interface LeadCounts {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  lost: number;
}

export async function countLeadsByStatus(): Promise<LeadCounts> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      isNew: sql<number>`count(*) filter (where ${leads.status} = 'new')`,
      contacted: sql<number>`count(*) filter (where ${leads.status} = 'contacted')`,
      qualified: sql<number>`count(*) filter (where ${leads.status} = 'qualified')`,
      lost: sql<number>`count(*) filter (where ${leads.status} = 'lost')`,
    })
    .from(leads);

  return {
    total: Number(row?.total ?? 0),
    new: Number(row?.isNew ?? 0),
    contacted: Number(row?.contacted ?? 0),
    qualified: Number(row?.qualified ?? 0),
    lost: Number(row?.lost ?? 0),
  };
}
