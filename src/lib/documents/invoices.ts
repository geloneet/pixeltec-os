import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type { Invoice } from "@/types/documents";

const COL = "invoices";

export async function getInvoices(
  firestore: Firestore,
  uid: string,
  clientId?: string,
): Promise<Invoice[]> {
  const ref = collection(firestore, COL);
  const constraints = clientId
    ? [where("uid", "==", uid), where("clientId", "==", clientId), orderBy("createdAt", "desc")]
    : [where("uid", "==", uid), orderBy("createdAt", "desc")];
  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
}

export async function getNextInvoiceNumber(
  firestore: Firestore,
  uid: string,
): Promise<string> {
  const snap = await getDocs(
    query(collection(firestore, COL), where("uid", "==", uid)),
  );
  const year = new Date().getFullYear();
  const n = snap.size + 1;
  return `FAC-${year}-${String(n).padStart(3, "0")}`;
}

export async function createInvoice(
  firestore: Firestore,
  uid: string,
  clientId: string,
  data: Omit<Invoice, "id" | "uid" | "clientId" | "createdAt" | "updatedAt">,
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

export async function updateInvoice(
  firestore: Firestore,
  id: string,
  data: Partial<Omit<Invoice, "id" | "uid" | "clientId" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(firestore, COL, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}
