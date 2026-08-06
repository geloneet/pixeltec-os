"use server";

/**
 * Server actions del núcleo CRM (Fase 4) — reemplazan la lectura/escritura
 * directa a Firestore que hacía `CRMContextCore.tsx`. Ver `crm-sync.ts` para
 * la lógica de reconciliación real; este archivo solo autentica y delega.
 */
import { auth } from "@/lib/auth/config";
import {
  getFullCrmData,
  syncCrmClients,
  syncCrmTools,
  syncCrmStreak,
  syncCrmServerLinks,
  syncCrmSessions,
} from "@/lib/db/repos/crm-sync";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { resolveClientPgId } from "@/lib/documents/pg";
import {
  logClientActivity,
  getClientActivityRows,
  type ClientActivityType,
} from "@/lib/db/repos/client-activity";
import type { CRMClient, ClientCrmStatus, ClientNextAction, Tool, ServerClientLink } from "@/types/crm";
import type { WorkSession } from "@/types/session";
import { toPublicFailure } from "@/lib/errors/public-failure";

async function requireOwnerId(): Promise<string> {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) throw new Error("No autenticado");
  return ownerId;
}

export async function getCrmDataAction() {
  const ownerId = await requireOwnerId();
  return getFullCrmData(ownerId);
}

// Espeja el `changedKeys` que ya usaba `CRMContextCore.persist()` contra
// Firestore — cada sección se reconcilia de forma independiente.
export interface CrmSyncPayload {
  clients?: CRMClient[];
  tools?: Tool[];
  streak?: number;
  serverLinks?: ServerClientLink;
  sessions?: WorkSession[];
}

export async function syncCrmDataAction(payload: CrmSyncPayload): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ownerId = await requireOwnerId();
    const jobs: Array<Promise<void>> = [];
    if (payload.clients) jobs.push(syncCrmClients(ownerId, payload.clients));
    if (payload.tools) jobs.push(syncCrmTools(ownerId, payload.tools));
    if (payload.streak !== undefined) jobs.push(syncCrmStreak(ownerId, payload.streak));
    if (payload.serverLinks) jobs.push(syncCrmServerLinks(ownerId, payload.serverLinks));
    if (payload.sessions) jobs.push(syncCrmSessions(ownerId, payload.sessions));
    await Promise.all(jobs);
    return { ok: true };
  } catch (error) {
    // Este `catch` cubre la sincronización completa del CRM: un fallo de
    // Drizzle citaba aquí la consulta y los nombres de columna, y el
    // la conversión a texto arrastraba objetos enteros. `CRMContextCore` muestra
    // este campo directamente.
    console.error("[syncCrmDataAction]", error);
    return {
      ok: false,
      error: toPublicFailure(error, {
        code: "crm_sync_failed",
        message: "No se pudo sincronizar la información del CRM.",
      }).message,
    };
  }
}

// ── Campos server-owned + historial (ADR-0034) ──────────────────────────────
// Estas actions son la ÚNICA puerta de escritura de crm_status/next_action:
// syncCrmClients no incluye esos campos, así un blob stale no puede pisarlos.

type ActionResult = { ok: true } | { ok: false; error: string };

const CRM_STATUSES: ClientCrmStatus[] = ["prospecto", "activo", "pausado", "cerrado"];

const STATUS_LABEL: Record<ClientCrmStatus, string> = {
  prospecto: "Prospecto",
  activo: "Cliente activo",
  pausado: "Pausado",
  cerrado: "Cerrado",
};

async function resolveOwnedClient(publicClientId: string): Promise<{ ownerId: string; clientPgId: string }> {
  const ownerId = await requireOwnerId();
  const clientPgId = await resolveClientPgId(publicClientId);
  if (!clientPgId) throw new Error("Cliente no encontrado");
  return { ownerId, clientPgId };
}

export async function setClientStatusAction(
  publicClientId: string,
  status: ClientCrmStatus
): Promise<ActionResult> {
  try {
    if (!CRM_STATUSES.includes(status)) throw new Error("Estado inválido");
    const { ownerId, clientPgId } = await resolveOwnedClient(publicClientId);
    await db.update(clients).set({ crmStatus: status }).where(eq(clients.id, clientPgId));
    await logClientActivity({
      ownerId,
      clientId: clientPgId,
      type: "estado_cambiado",
      message: `Estado del cliente: ${STATUS_LABEL[status]}`,
    });
    return { ok: true };
  } catch (error) {
    console.error("[setClientStatusAction]", error);
    return {
      ok: false,
      error: toPublicFailure(error, {
        code: "client_status_failed",
        message: "No se pudo actualizar el estado del cliente.",
      }).message,
    };
  }
}

export async function setClientNextActionAction(
  publicClientId: string,
  nextAction: ClientNextAction | null
): Promise<ActionResult> {
  try {
    const clean: ClientNextAction | null =
      nextAction && nextAction.label.trim().length > 0
        ? { label: nextAction.label.trim().slice(0, 200), dueAt: nextAction.dueAt }
        : null;
    const { ownerId, clientPgId } = await resolveOwnedClient(publicClientId);
    await db.update(clients).set({ nextAction: clean }).where(eq(clients.id, clientPgId));
    if (clean) {
      await logClientActivity({
        ownerId,
        clientId: clientPgId,
        type: "seguimiento",
        message: `Seguimiento registrado: ${clean.label}`,
        metadata: clean.dueAt ? { dueAt: clean.dueAt } : undefined,
      });
    }
    return { ok: true };
  } catch (error) {
    console.error("[setClientNextActionAction]", error);
    return {
      ok: false,
      error: toPublicFailure(error, {
        code: "client_next_action_failed",
        message: "No se pudo registrar la próxima acción.",
      }).message,
    };
  }
}

/** Eventos de ciclo de vida emitidos desde la UI del CRM (alta/edición). */
export async function logClientEventAction(
  publicClientId: string,
  type: Extract<ClientActivityType, "cliente_creado" | "cliente_editado">,
  message: string
): Promise<void> {
  try {
    const { ownerId, clientPgId } = await resolveOwnedClient(publicClientId);
    await logClientActivity({ ownerId, clientId: clientPgId, type, message: message.slice(0, 300) });
  } catch (error) {
    // Historial secundario: nunca rompe el flujo que lo origina.
    console.error("[logClientEventAction]", error);
  }
}

/** Expediente documental del cliente (clients.documents jsonb) — v1 solo lectura. */
export interface ClientDocumentEntry {
  name: string;
  url: string;
  uploadedAt?: string;
}

export async function getClientDocumentsAction(publicClientId: string): Promise<ClientDocumentEntry[]> {
  try {
    const { clientPgId } = await resolveOwnedClient(publicClientId);
    const [row] = await db
      .select({ documents: clients.documents })
      .from(clients)
      .where(eq(clients.id, clientPgId))
      .limit(1);
    const docs = (row?.documents as ClientDocumentEntry[] | null) ?? [];
    return docs.filter((d) => typeof d?.name === "string" && typeof d?.url === "string");
  } catch (error) {
    console.error("[getClientDocumentsAction]", error);
    return [];
  }
}

export interface ClientActivityEntry {
  id: string;
  type: string;
  message: string;
  actorName: string | null;
  createdAt: string;
}

export async function getClientActivityAction(
  publicClientId: string,
  limit = 20
): Promise<ClientActivityEntry[]> {
  try {
    const { ownerId, clientPgId } = await resolveOwnedClient(publicClientId);
    const rows = await getClientActivityRows(ownerId, clientPgId, limit);
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      message: r.message,
      actorName: r.actorName,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("[getClientActivityAction]", error);
    return [];
  }
}
