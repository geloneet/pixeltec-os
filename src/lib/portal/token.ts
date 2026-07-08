// Fase 4: el token de portal (`/portal/[token]`) vivía en una colección
// auxiliar de Firestore (`portal_tokens`) + el campo `portalToken` dentro del
// blob `crm_data/{uid}.clients[]`. Ahora `clients.portal_token` en Postgres
// ya tiene un índice único (`clients_portal_token_idx`) — no hace falta una
// tabla de lookup separada, basta con consultar `clients` directamente.
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, clients } from "@/lib/db/schema";

async function resolveOwnerAndClient(uid: string, clientId: string) {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.firebaseUid, uid)).limit(1);
  if (!user) return null;
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.ownerId, user.id), eq(clients.source, "crm_blob"), eq(clients.firestoreId, clientId)))
    .limit(1);
  if (!client) return null;
  return client.id;
}

export async function generatePortalToken(uid: string, clientId: string): Promise<string> {
  const clientPgId = await resolveOwnerAndClient(uid, clientId);
  if (!clientPgId) throw new Error("Cliente no encontrado");

  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await db.update(clients).set({ portalToken: token, portalEnabled: true }).where(eq(clients.id, clientPgId));
  return token;
}

export async function revokePortalToken(uid: string, clientId: string): Promise<void> {
  const clientPgId = await resolveOwnerAndClient(uid, clientId);
  if (!clientPgId) return;
  await db.update(clients).set({ portalToken: null, portalEnabled: false }).where(eq(clients.id, clientPgId));
}

export async function resolveToken(token: string): Promise<{ uid: string; clientId: string } | null> {
  const [row] = await db
    .select({ ownerId: clients.ownerId, firestoreId: clients.firestoreId })
    .from(clients)
    .where(eq(clients.portalToken, token))
    .limit(1);
  if (!row || !row.firestoreId) return null;
  const [owner] = await db.select({ firebaseUid: users.firebaseUid }).from(users).where(eq(users.id, row.ownerId)).limit(1);
  if (!owner?.firebaseUid) return null;
  return { uid: owner.firebaseUid, clientId: row.firestoreId };
}
