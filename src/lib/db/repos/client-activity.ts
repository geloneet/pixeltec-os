// Historial verificable del cliente (ADR-0034): qué ocurrió, quién y cuándo.
// Los writers viven en las server actions de cada dominio (proposals,
// contracts, invoices, portal, crm-actions) — este repo solo inserta y lee.
import { desc, eq, and, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientActivity, clients, type ClientActivityRow } from "@/lib/db/schema";

/** Vocabulario cerrado en TS (la columna es text: extensible sin migración). */
export type ClientActivityType =
  | "cliente_creado"
  | "cliente_editado"
  | "estado_cambiado"
  | "seguimiento"
  | "propuesta_publicada"
  | "propuesta_enviada"
  | "propuesta_vista"
  | "propuesta_aceptada"
  | "propuesta_rechazada"
  | "contrato_creado"
  | "contrato_firmado"
  | "factura_creada"
  | "factura_pagada"
  | "portal_activado"
  | "portal_desactivado";

export interface ClientActivityInput {
  ownerId: string;
  /** clients.id (uuid de Postgres, ya resuelto). */
  clientId: string;
  type: ClientActivityType;
  message: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registra actividad SIN propagar errores: el historial es secundario a la
 * operación que lo origina (una propuesta enviada no puede fallar porque el
 * log falló). El error se reporta a consola y se sigue.
 */
export async function logClientActivity(input: ClientActivityInput): Promise<void> {
  try {
    await db.insert(clientActivity).values({
      ownerId: input.ownerId,
      clientId: input.clientId,
      type: input.type,
      message: input.message,
      actorName: input.actorName ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    console.error("[logClientActivity]", input.type, error);
  }
}

export interface ClientLastActivityRow {
  /** clients.id (uuid de Postgres). */
  clientId: string;
  /** Id original de Firestore si la fila fue migrada (id público preferente). */
  firestoreId: string | null;
  lastActivityAt: Date | string | null;
}

/**
 * Última actividad por cliente del owner en UNA consulta agregada
 * (`MAX(created_at) GROUP BY client_id`, cubierta por el índice
 * `(client_id, created_at)`), con join a clients para poder devolver el id
 * público (firestore_id ?? uuid) sin N consultas de resolución.
 */
export async function getClientsLastActivityRows(ownerId: string): Promise<ClientLastActivityRow[]> {
  return db
    .select({
      clientId: clientActivity.clientId,
      firestoreId: clients.firestoreId,
      lastActivityAt: max(clientActivity.createdAt),
    })
    .from(clientActivity)
    .innerJoin(clients, eq(clients.id, clientActivity.clientId))
    .where(eq(clientActivity.ownerId, ownerId))
    .groupBy(clientActivity.clientId, clients.firestoreId);
}

export async function getClientActivityRows(
  ownerId: string,
  clientPgId: string,
  limit = 20
): Promise<ClientActivityRow[]> {
  return db
    .select()
    .from(clientActivity)
    .where(and(eq(clientActivity.ownerId, ownerId), eq(clientActivity.clientId, clientPgId)))
    .orderBy(desc(clientActivity.createdAt))
    .limit(limit);
}
