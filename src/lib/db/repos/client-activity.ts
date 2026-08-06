// Historial verificable del cliente (ADR-0034): qué ocurrió, quién y cuándo.
// Los writers viven en las server actions de cada dominio (proposals,
// contracts, invoices, portal, crm-actions) — este repo solo inserta y lee.
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientActivity, type ClientActivityRow } from "@/lib/db/schema";

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
