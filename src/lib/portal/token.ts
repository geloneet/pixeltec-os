import { getAdminFirestore } from "@/lib/firebase-admin";

const TOKENS_COL = "portal_tokens";

export async function generatePortalToken(
  uid: string,
  clientId: string,
): Promise<string> {
  const db = getAdminFirestore();

  // Check if client already has a token — revoke it first
  const crmSnap = await db.collection("crm_data").doc(uid).get();
  if (crmSnap.exists) {
    const clients = (crmSnap.data()?.clients ?? []) as Array<{ id: string; portalToken?: string }>;
    const existing = clients.find(c => c.id === clientId);
    if (existing?.portalToken) {
      // Delete old token doc (fire-and-forget, ignore errors)
      await db.collection(TOKENS_COL).doc(existing.portalToken).delete().catch(() => {});
    }
  }

  // Generate 32-char hex token
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const now = new Date().toISOString();

  // Write to auxiliary lookup collection
  await db.collection(TOKENS_COL).doc(token).set({ uid, clientId, createdAt: now });

  // Update client record in crm_data
  const snap = await db.collection("crm_data").doc(uid).get();
  if (snap.exists) {
    const data = snap.data()!;
    const clients = (data.clients ?? []) as Array<{ id: string; [key: string]: unknown }>;
    const updated = clients.map(c =>
      c.id === clientId
        ? { ...c, portalToken: token, portalEnabled: true }
        : c,
    );
    await db.collection("crm_data").doc(uid).update({ clients: updated });
  }

  return token;
}

export async function revokePortalToken(
  uid: string,
  clientId: string,
): Promise<void> {
  const db = getAdminFirestore();

  // Find current token
  const snap = await db.collection("crm_data").doc(uid).get();
  if (!snap.exists) return;
  const clients = (snap.data()?.clients ?? []) as Array<{ id: string; portalToken?: string }>;
  const client = clients.find(c => c.id === clientId);
  if (client?.portalToken) {
    await db.collection(TOKENS_COL).doc(client.portalToken).delete().catch(() => {});
  }

  // Clear token from crm_data
  const updated = clients.map(c =>
    c.id === clientId
      ? { ...c, portalToken: undefined, portalEnabled: false }
      : c,
  );
  await db.collection("crm_data").doc(uid).update({ clients: updated });
}

export async function resolveToken(
  token: string,
): Promise<{ uid: string; clientId: string } | null> {
  const snap = await getAdminFirestore().collection(TOKENS_COL).doc(token).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return { uid: data.uid as string, clientId: data.clientId as string };
}
