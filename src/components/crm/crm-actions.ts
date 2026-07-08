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
import type { CRMClient, Tool, ServerClientLink } from "@/types/crm";
import type { WorkSession } from "@/types/session";

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
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
