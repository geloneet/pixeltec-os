import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc,
  orderBy,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type { IATemplate, IATemplateType } from "@/types/documents";

const COL = "ia_templates";

export function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{([^}]+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "").trim()))];
}

export async function getTemplates(
  firestore: Firestore,
  uid: string,
  type?: IATemplateType,
): Promise<IATemplate[]> {
  const ref = collection(firestore, COL);
  const constraints = type
    ? [where("uid", "==", uid), where("type", "==", type), orderBy("createdAt", "desc")]
    : [where("uid", "==", uid), orderBy("createdAt", "desc")];
  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as IATemplate));
}

export async function createTemplate(
  firestore: Firestore,
  uid: string,
  data: Omit<IATemplate, "id" | "uid" | "createdAt" | "updatedAt">,
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(firestore, COL), {
    ...data,
    uid,
    variables: extractVariables(data.content),
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateTemplate(
  firestore: Firestore,
  id: string,
  data: Partial<Omit<IATemplate, "id" | "uid" | "createdAt">>,
): Promise<void> {
  const updates = { ...data, updatedAt: new Date().toISOString() };
  if (data.content) {
    updates.variables = extractVariables(data.content);
  }
  await updateDoc(doc(firestore, COL, id), updates);
}

export async function deleteTemplate(
  firestore: Firestore,
  id: string,
): Promise<void> {
  await deleteDoc(doc(firestore, COL, id));
}
