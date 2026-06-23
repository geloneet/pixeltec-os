import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy, limit,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type { DiscoverySession } from "@/types/documents";

const COL = "discovery_sessions";

export async function getDiscoverySessions(
  firestore: Firestore,
  uid: string,
  clientId: string,
): Promise<DiscoverySession[]> {
  const snap = await getDocs(
    query(
      collection(firestore, COL),
      where("uid", "==", uid),
      where("clientId", "==", clientId),
      orderBy("generatedAt", "desc"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DiscoverySession));
}

export async function getLatestDiscoverySession(
  firestore: Firestore,
  uid: string,
  clientId: string,
): Promise<DiscoverySession | null> {
  const snap = await getDocs(
    query(
      collection(firestore, COL),
      where("uid", "==", uid),
      where("clientId", "==", clientId),
      orderBy("generatedAt", "desc"),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as DiscoverySession;
}

export async function createDiscoverySession(
  firestore: Firestore,
  uid: string,
  clientId: string,
  data: Omit<DiscoverySession, "id" | "uid" | "clientId">,
): Promise<string> {
  const ref = await addDoc(collection(firestore, COL), {
    ...data,
    uid,
    clientId,
  });
  return ref.id;
}

export async function updateDiscoverySession(
  firestore: Firestore,
  id: string,
  data: Partial<Omit<DiscoverySession, "id" | "uid" | "clientId">>,
): Promise<void> {
  await updateDoc(doc(firestore, COL, id), data);
}
