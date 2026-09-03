"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clients, leads } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-guards";

/**
 * Acciones mínimas de la bandeja de leads (WO-2026-00214, A13).
 *
 * Sólo dos operaciones: mover el estado del lead y vincularlo a un cliente. No
 * hay edición de datos del lead — lo que el visitante escribió es evidencia de
 * lo que pidió, y dejar que alguien lo reescriba desde el panel destruiría esa
 * evidencia sin dejar rastro.
 *
 * `converted_at` NO se escribe aquí: se deriva de la primera venta del cliente
 * vinculado (ver `admin-queries.ts`). La UI no ofrece ponerlo a mano.
 */

const LEADS_ROUTE = "/clientes/leads";

export type LeadActionResult = { ok: true } | { ok: false; error: string };

const StatusSchema = z.enum(["new", "contacted", "qualified", "lost"]);
const UuidSchema = z.string().uuid();

/**
 * Cambia el estado del lead.
 *
 * Pasar a `qualified` sella `qualified_at` la PRIMERA vez y no lo vuelve a
 * tocar: si alguien mueve el lead a `contacted` y luego otra vez a
 * `qualified`, la fecha original se conserva. Reescribirla convertiría "cuándo
 * se calificó" en "la última vez que alguien tocó el selector".
 */
export async function setLeadStatusAction(
  leadId: string,
  status: string
): Promise<LeadActionResult> {
  const guard = await requireAdmin(undefined, { route: LEADS_ROUTE });
  if (!guard.ok) return { ok: false, error: guard.error };

  const id = UuidSchema.safeParse(leadId);
  const nextStatus = StatusSchema.safeParse(status);
  if (!id.success || !nextStatus.success) return { ok: false, error: "invalid_input" };

  try {
    const [current] = await db
      .select({ qualifiedAt: leads.qualifiedAt })
      .from(leads)
      .where(eq(leads.id, id.data))
      .limit(1);
    if (!current) return { ok: false, error: "not_found" };

    await db
      .update(leads)
      .set({
        status: nextStatus.data,
        ...(nextStatus.data === "qualified" && current.qualifiedAt === null
          ? { qualifiedAt: new Date() }
          : {}),
      })
      .where(eq(leads.id, id.data));
  } catch (err) {
    console.error("[leads-admin] setLeadStatus failed:", err);
    return { ok: false, error: "update_failed" };
  }

  revalidatePath(LEADS_ROUTE);
  return { ok: true };
}

/**
 * Vincula (o desvincula, con `clientId = null`) el lead a un cliente. Es lo que
 * permite derivar el ingreso atribuible a un contenido: `lead.client_id →
 * sales`. Sin esta vinculación el embudo termina en "lead" y nunca llega al
 * dinero.
 */
export async function linkLeadToClientAction(
  leadId: string,
  clientId: string | null
): Promise<LeadActionResult> {
  const guard = await requireAdmin(undefined, { route: LEADS_ROUTE });
  if (!guard.ok) return { ok: false, error: guard.error };

  const id = UuidSchema.safeParse(leadId);
  if (!id.success) return { ok: false, error: "invalid_input" };

  let resolvedClient: string | null = null;
  if (clientId !== null && clientId !== "") {
    const parsed = UuidSchema.safeParse(clientId);
    if (!parsed.success) return { ok: false, error: "invalid_input" };
    // Se comprueba que el cliente exista antes de escribir: la FK lo haría
    // igual, pero con un error de Postgres crudo en vez de un mensaje útil.
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, parsed.data))
      .limit(1);
    if (!client) return { ok: false, error: "client_not_found" };
    resolvedClient = parsed.data;
  }

  try {
    await db.update(leads).set({ clientId: resolvedClient }).where(eq(leads.id, id.data));
  } catch (err) {
    console.error("[leads-admin] linkLeadToClient failed:", err);
    return { ok: false, error: "update_failed" };
  }

  revalidatePath(LEADS_ROUTE);
  return { ok: true };
}
