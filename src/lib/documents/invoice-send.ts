'use server';

// Fase 4 (M5): junta factura + cliente + PDF + email — capa fina que dispara
// el envío de la factura al CLIENTE cuando pasa a "enviada" desde
// FacturacionTab. No agrega lógica de negocio nueva: reutiliza
// resolveInvoiceRow/serializeInvoice (pg.ts), generateInvoicePdf (Task 9) y
// sendInvoiceToClient (lib/email.ts, Task 6/10).
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, invoiceItems } from "@/lib/db/schema";
import { requireOwner, resolveInvoiceRow, serializeInvoice } from "./pg";
import { generateInvoicePdf } from "./invoice-pdf-render";
import { sendInvoiceToClient } from "@/lib/email";

export async function sendInvoiceForClient(invoiceId: string): Promise<{ ok: boolean; reason?: string }> {
  const { uid, ownerId } = await requireOwner();
  const row = await resolveInvoiceRow(invoiceId);
  if (!row || row.ownerId !== ownerId) return { ok: false, reason: "not_found" };

  const [client] = await db
    .select({ email: clients.email, name: clients.name })
    .from(clients)
    .where(eq(clients.id, row.clientId))
    .limit(1);
  if (!client?.email) return { ok: false, reason: "client_has_no_email" };

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, row.id))
    .orderBy(invoiceItems.id);
  const invoice = serializeInvoice(row, items, row.clientId, uid);
  const pdfBuffer = await generateInvoicePdf(invoice, client.name);

  const result = await sendInvoiceToClient(client.email, client.name, invoice.number, pdfBuffer);
  return { ok: result.success, reason: result.error };
}
