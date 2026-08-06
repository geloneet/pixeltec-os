"use client";

/**
 * Wrapper cliente para /api/whatsapp-inbox/contacts* — reemplaza las
 * escrituras directas a Firestore de src/lib/whatsapp-inbox/contacts.ts
 * (retirado, Fase B). Mismo estilo "raw fetch" que Composer.tsx ya usa para
 * /api/whatsapp-inbox/send.
 *
 * `byUid`/`createdBy` ya NO viajan en el body: el servidor los deriva de la
 * sesión vía el guard `requireAdmin` (ver las rutas). Los callers ya no
 * necesitan pasar el uid del usuario actual para estas escrituras.
 */
import type { ContactPatch } from "@/lib/db/repos/whatsapp-contacts";
import type { ContactNote, WhatsAppContact } from "@/types/whatsapp-inbox";

/**
 * Un 502/504 del proxy responde HTML, no JSON: sin esto, `res.json()` lanza
 * un `SyntaxError` críptico en vez del status HTTP accionable.
 */
async function parseJsonResponse(res: Response): Promise<Record<string, any>> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  if (data === null) throw new Error(`HTTP ${res.status}: respuesta no-JSON`);
  return data;
}

export async function upsertContact(
  phone: string,
  patch: ContactPatch,
  action?: string
): Promise<WhatsAppContact> {
  const res = await fetch("/api/whatsapp-inbox/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, patch, action }),
  });
  const data = await parseJsonResponse(res);
  return data.contact as WhatsAppContact;
}

export async function addContactNote(phone: string, text: string): Promise<ContactNote> {
  const res = await fetch(`/api/whatsapp-inbox/contacts/${encodeURIComponent(phone)}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await parseJsonResponse(res);
  return data.note as ContactNote;
}

export async function createWhatsappTicket(
  phone: string,
  problema: string,
  contactName?: string | null
): Promise<{ ticketId: string }> {
  const res = await fetch("/api/whatsapp-inbox/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, problema, contactName }),
  });
  const data = await parseJsonResponse(res);
  return { ticketId: data.ticket.ticketId as string };
}
