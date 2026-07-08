// Fase 4: Postgres/Drizzle — antes colección Firestore `portal_requests`.
// `clientId` público (firestore_id para migrados, uuid para nuevos) se
// traduce a la FK uuid en la frontera, igual que el resto del portal.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, portalRequests } from "@/lib/db/schema";
import type { PortalRequest } from "@/types/portal";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveClientPgId(publicClientId: string): Promise<string | null> {
  const id = publicClientId.trim();
  const [byFs] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.firestoreId, id))
    .limit(1);
  if (byFs) return byFs.id;
  if (!UUID_RE.test(id)) return null;
  const [byId] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, id)).limit(1);
  return byId?.id ?? null;
}

export async function createPortalRequest(
  data: Omit<PortalRequest, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const clientPgId = await resolveClientPgId(data.clientId);
  if (!clientPgId) throw new Error("Cliente no encontrado");

  const [row] = await db
    .insert(portalRequests)
    .values({
      uid: data.uid,
      clientId: clientPgId,
      token: data.token,
      type: data.type,
      title: data.title,
      description: data.description,
      status: data.status,
      linkedTaskId: data.linkedTaskId ?? null,
    })
    .returning({ id: portalRequests.id });
  return row.id;
}

export async function getPortalRequests(
  uid: string,
  clientId: string,
  limitCount = 20,
): Promise<PortalRequest[]> {
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) return [];

  const rows = await db
    .select()
    .from(portalRequests)
    .where(and(eq(portalRequests.uid, uid), eq(portalRequests.clientId, clientPgId)))
    .orderBy(desc(portalRequests.createdAt))
    .limit(limitCount);

  return rows.map((r) => ({
    id: r.firestoreId ?? r.id,
    uid: r.uid,
    clientId,
    token: r.token,
    type: r.type as PortalRequest["type"],
    title: r.title,
    description: r.description,
    status: r.status as PortalRequest["status"],
    linkedTaskId: r.linkedTaskId ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}
