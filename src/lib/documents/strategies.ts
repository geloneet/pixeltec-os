import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, limit,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type { Strategy } from "@/types/documents";

const COL = "strategies";

export async function getStrategy(
  firestore: Firestore,
  uid: string,
  clientId: string,
): Promise<Strategy | null> {
  const snap = await getDocs(
    query(
      collection(firestore, COL),
      where("uid", "==", uid),
      where("clientId", "==", clientId),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Strategy;
}

export async function createStrategy(
  firestore: Firestore,
  uid: string,
  clientId: string,
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(firestore, COL), {
    uid,
    clientId,
    objectives: [],
    kpis: [],
    roadmap: [],
    priorities: [],
    channels: [],
    automations: [],
    lastUpdated: now,
  });
  return ref.id;
}

export async function updateStrategy(
  firestore: Firestore,
  id: string,
  data: Partial<Omit<Strategy, "id" | "uid" | "clientId">>,
): Promise<void> {
  await updateDoc(doc(firestore, COL, id), {
    ...data,
    lastUpdated: new Date().toISOString(),
  });
}
