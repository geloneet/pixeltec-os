import { getAdminFirestore } from "@/lib/firebase-admin";

const TOKENS_COL = "portal_tokens";

export async function generatePortalToken(
  uid: string,
  clientId: string,
): Promise<string> {
  const db = getAdminFirestore();

  // Single read — derive old token and new clients array from one snapshot (avoids TOCTOU)
  const crmSnap = await db.collection("crm_data").doc(uid).get();
  const existingClients = crmSnap.exists
    ? ((crmSnap.data()?.clients ?? []) as Array<{ id: string; portalToken?: string; [key: string]: unknown }>)
    : [];

  const oldToken = existingClients.find(c => c.id === clientId)?.portalToken;
  if (oldToken) {
    await db.collection(TOKENS_COL).doc(oldToken).delete().catch(() => {});
  }

  // Generate 32-char hex token
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const now = new Date().toISOString();

  // Write to auxiliary lookup collection
  await db.collection(TOKENS_COL).doc(token).set({ uid, clientId, createdAt: now });

  // Update client record using the same snapshot (no second read)
  if (crmSnap.exists) {
    const updated = existingClients.map(c =>
      c.id === clientId ? { ...c, portalToken: token, portalEnabled: true } : c,
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

  // Clear token from crm_data. Firestore's Admin SDK rejects `undefined` as a
  // field value (this project does not call `ignoreUndefinedProperties`), and
  // `FieldValue.delete()` cannot be used inside array elements — so we just
  // omit the `portalToken` key entirely from the replacement array element.
  const updated = clients.map(c => {
    if (c.id !== clientId) return c;
    const next: { id: string; portalToken?: string; portalEnabled: boolean } = {
      ...c,
      portalEnabled: false,
    };
    delete next.portalToken;
    return next;
  });
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
