/**
 * Repo del último remanente de Firestore del módulo WhatsApp Inbox —
 * `whatsappContacts` (contacto/clasificación/tags/notas). Ver
 * src/lib/db/schema.ts (sección "WhatsApp Inbox — contactos") para el
 * modelado. Sustituye a src/lib/whatsapp-inbox/contacts.ts (Firestore,
 * retirado).
 *
 * `upsertContact` replica el merge parcial de `setDoc(..., {merge:true})`
 * de Firestore: solo las claves PRESENTES en `patch` (aunque su valor sea
 * `null`) se escriben; las claves ausentes dejan el valor existente
 * intacto. `actionHistory` se lee-modifica-escribe dentro de la misma
 * transacción (equivalente atómico a `arrayUnion`).
 */
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  whatsappContactNotes,
  whatsappContacts,
  type NewWhatsappContactRow,
  type WhatsappContactNoteRow,
  type WhatsappContactRow,
} from "@/lib/db/schema";
import type { ContactAction, ContactNote, WhatsAppContact } from "@/types/whatsapp-inbox";

function rowToContact(row: WhatsappContactRow): WhatsAppContact {
  return {
    id: row.phone,
    name: row.name ?? undefined,
    classification: row.classification ?? null,
    tags: (row.tags as string[] | null) ?? [],
    assignedTo: row.assignedTo ?? null,
    origin: row.origin ?? undefined,
    status: row.status ?? undefined,
    urgent: row.urgent,
    linkedClientId: row.linkedClientId ?? null,
    actionHistory: (row.actionHistory as ContactAction[] | null) ?? [],
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

function rowToNote(row: WhatsappContactNoteRow): ContactNote {
  return {
    id: row.id,
    text: row.text,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listContacts(): Promise<WhatsAppContact[]> {
  const rows = await db.select().from(whatsappContacts);
  return rows.map(rowToContact);
}

export async function getContact(phone: string): Promise<WhatsAppContact | null> {
  const rows = await db.select().from(whatsappContacts).where(eq(whatsappContacts.phone, phone));
  return rows[0] ? rowToContact(rows[0]) : null;
}

export type ContactPatch = Partial<
  Pick<
    WhatsAppContact,
    | "name"
    | "classification"
    | "tags"
    | "assignedTo"
    | "origin"
    | "status"
    | "urgent"
    | "linkedClientId"
  >
>;

/**
 * Upsert con merge parcial + append atómico a actionHistory. Crea la fila
 * si no existe (equivalente a `setDoc(..., {merge:true})` sobre un doc
 * inexistente) y siempre pisa `updatedAt`; `createdAt` se fija solo la
 * primera vez que la fila se crea (el caller ya no necesita pasarlo, a
 * diferencia de la versión Firestore que usaba `serverTimestamp()` en el
 * payload).
 */
export async function upsertContact(
  phone: string,
  patch: ContactPatch,
  byUid: string,
  action?: string
): Promise<WhatsAppContact> {
  return db.transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.phone, phone));
    const existing = existingRows[0];

    const prevHistory = (existing?.actionHistory as ContactAction[] | null) ?? [];
    const actionHistory: ContactAction[] = action
      ? [...prevHistory, { at: new Date().toISOString(), byUid, action }]
      : prevHistory;

    const has = <K extends keyof ContactPatch>(key: K) =>
      Object.prototype.hasOwnProperty.call(patch, key);

    const now = new Date();
    const merged: NewWhatsappContactRow = {
      phone,
      name: has("name") ? patch.name ?? null : existing?.name ?? null,
      classification: has("classification")
        ? patch.classification ?? null
        : existing?.classification ?? null,
      tags: has("tags") ? patch.tags ?? [] : (existing?.tags as string[] | null) ?? [],
      assignedTo: has("assignedTo") ? patch.assignedTo ?? null : existing?.assignedTo ?? null,
      origin: has("origin") ? patch.origin ?? null : existing?.origin ?? null,
      status: has("status") ? patch.status ?? null : existing?.status ?? null,
      urgent: has("urgent") ? Boolean(patch.urgent) : existing?.urgent ?? false,
      linkedClientId: has("linkedClientId")
        ? patch.linkedClientId ?? null
        : existing?.linkedClientId ?? null,
      actionHistory,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const [row] = await tx
      .insert(whatsappContacts)
      .values(merged)
      .onConflictDoUpdate({ target: whatsappContacts.phone, set: merged })
      .returning();

    return rowToContact(row);
  });
}

export async function listNotes(phone: string): Promise<ContactNote[]> {
  const rows = await db
    .select()
    .from(whatsappContactNotes)
    .where(eq(whatsappContactNotes.contactPhone, phone))
    .orderBy(asc(whatsappContactNotes.createdAt));
  return rows.map(rowToNote);
}

/**
 * Igual que en Firestore: se puede anotar un teléfono que todavía no tiene
 * fila de contacto (el composer permite dejar una nota interna sin haber
 * "guardado" el contacto antes). Se garantiza una fila mínima primero
 * (ON CONFLICT DO NOTHING) para que la FK de whatsapp_contact_notes nunca
 * falle.
 */
export async function addNote(phone: string, text: string, byUid: string): Promise<ContactNote> {
  return db.transaction(async (tx) => {
    await tx
      .insert(whatsappContacts)
      .values({ phone })
      .onConflictDoNothing({ target: whatsappContacts.phone });

    const [row] = await tx
      .insert(whatsappContactNotes)
      .values({ contactPhone: phone, text, createdBy: byUid })
      .returning();

    return rowToNote(row);
  });
}
