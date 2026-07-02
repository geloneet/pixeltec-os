import {
  arrayUnion,
  collection,
  doc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  addDoc,
  type DocumentReference,
  type Firestore,
  type PartialWithFieldValue,
  type Query,
} from 'firebase/firestore';
import type { ContactAction, ContactNote, WhatsAppContact } from '@/types/whatsapp-inbox';

export function contactRef(fs: Firestore, phone: string): DocumentReference<WhatsAppContact> {
  return doc(fs, 'whatsappContacts', phone) as DocumentReference<WhatsAppContact>;
}

export function notesQuery(fs: Firestore, phone: string): Query<ContactNote> {
  return query(
    collection(fs, 'whatsappContacts', phone, 'notes'),
    orderBy('createdAt', 'asc')
  ) as Query<ContactNote>;
}

// Firestore rechaza valores `undefined` — los quita antes de escribir.
// Shallow a propósito: preserva los sentinels de FieldValue (serverTimestamp/arrayUnion)
// que un strip recursivo vía JSON.stringify destruiría.
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** setDoc merge; si `action` viene, agrega {at: ISO now, byUid, action} a actionHistory via arrayUnion
 *  y siempre pisa updatedAt: serverTimestamp(). createdAt solo con merge la primera vez:
 *  el caller que sabe que el doc no existía pasa {createdAt: serverTimestamp()} dentro de data. */
export async function upsertContact(
  fs: Firestore,
  phone: string,
  data: Partial<Omit<WhatsAppContact, 'id' | 'actionHistory'>>,
  byUid: string,
  action?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  if (action) {
    const entry: ContactAction = { at: new Date().toISOString(), byUid, action };
    payload.actionHistory = arrayUnion(entry);
  }

  await setDoc(
    contactRef(fs, phone),
    stripUndefined(payload) as PartialWithFieldValue<WhatsAppContact>,
    { merge: true }
  );
}

export async function addContactNote(fs: Firestore, phone: string, text: string, byUid: string): Promise<void> {
  await addDoc(collection(fs, 'whatsappContacts', phone, 'notes'), {
    text,
    createdBy: byUid,
    createdAt: serverTimestamp(),
  });
}
