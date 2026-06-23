import {
  collection, query, where, getDocs, getDoc, addDoc, updateDoc, doc, orderBy,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type { Contract } from "@/types/documents";

const COL = "contracts";

export async function getContracts(
  firestore: Firestore,
  uid: string,
  clientId?: string,
): Promise<Contract[]> {
  const ref = collection(firestore, COL);
  const constraints = clientId
    ? [where("uid", "==", uid), where("clientId", "==", clientId), orderBy("createdAt", "desc")]
    : [where("uid", "==", uid), orderBy("createdAt", "desc")];
  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contract));
}

export async function getContract(
  firestore: Firestore,
  id: string,
): Promise<Contract | null> {
  const snap = await getDoc(doc(firestore, COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Contract;
}

export async function createContract(
  firestore: Firestore,
  uid: string,
  clientId: string,
  data: Omit<Contract, "id" | "uid" | "clientId" | "version" | "createdAt" | "updatedAt">,
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(firestore, COL), {
    ...data,
    uid,
    clientId,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateContract(
  firestore: Firestore,
  id: string,
  data: Partial<Omit<Contract, "id" | "uid" | "clientId" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(firestore, COL, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function createContractVersion(
  firestore: Firestore,
  contractId: string,
  uid: string,
  clientId: string,
): Promise<string> {
  const existing = await getContract(firestore, contractId);
  if (!existing) throw new Error(`Contract ${contractId} not found`);
  const { id: _id, pdfUrl: _pdfUrl, ...rest } = existing;
  const now = new Date().toISOString();
  const ref = await addDoc(collection(firestore, COL), {
    ...rest,
    version: existing.version + 1,
    status: "borrador",
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}
