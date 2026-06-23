import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type { Proposal } from "@/types/documents";

const COL = "proposals";

export async function getProposals(
  firestore: Firestore,
  uid: string,
  clientId?: string,
): Promise<Proposal[]> {
  const ref = collection(firestore, COL);
  const constraints = clientId
    ? [where("uid", "==", uid), where("clientId", "==", clientId), orderBy("createdAt", "desc")]
    : [where("uid", "==", uid), orderBy("createdAt", "desc")];
  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Proposal));
}

export async function createProposal(
  firestore: Firestore,
  uid: string,
  clientId: string,
  data: Omit<Proposal, "id" | "uid" | "clientId" | "createdAt" | "updatedAt">,
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(firestore, COL), {
    ...data,
    uid,
    clientId,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateProposal(
  firestore: Firestore,
  id: string,
  data: Partial<Omit<Proposal, "id" | "uid" | "clientId" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(firestore, COL, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}
