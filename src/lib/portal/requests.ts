import { getAdminFirestore } from "@/lib/firebase-admin";
import type { PortalRequest } from "@/types/portal";

const COL = "portal_requests";

export async function createPortalRequest(
  data: Omit<PortalRequest, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await getAdminFirestore().collection(COL).add({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function getPortalRequests(
  uid: string,
  clientId: string,
  limitCount = 20,
): Promise<PortalRequest[]> {
  const snap = await getAdminFirestore()
    .collection(COL)
    .where("uid", "==", uid)
    .where("clientId", "==", clientId)
    .orderBy("createdAt", "desc")
    .limit(limitCount)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PortalRequest));
}
