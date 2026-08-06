// Acceso server-side por token público (Fase 4: Postgres — antes Admin SDK
// sobre la colección `proposals`). Lo usan /p/[token] y las rutas
// /api/proposals/track|action y /api/documents/proposal-pdf.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, clients, users } from "@/lib/db/schema";
import type { Proposal, ProposalViewEvent } from "@/types/documents";
import { resolveProposalRow, serializeProposal } from "./pg";
import { logClientActivity } from "@/lib/db/repos/client-activity";

export async function getProposalByToken(
  token: string,
): Promise<(Proposal & { id: string }) | null> {
  const [r] = await db
    .select({ doc: proposals, clientFsId: clients.firestoreId, ownerUid: users.id })
    .from(proposals)
    .innerJoin(clients, eq(proposals.clientId, clients.id))
    .innerJoin(users, eq(proposals.ownerId, users.id))
    .where(eq(proposals.publicToken, token))
    .limit(1);
  if (!r) return null;
  return serializeProposal(r.doc, r.clientFsId ?? r.doc.clientId, r.ownerUid ?? "");
}

export async function logProposalView(
  proposal: Proposal & { id: string },
  ip?: string,
  userAgent?: string,
): Promise<void> {
  const row = await resolveProposalRow(proposal.id);
  if (!row) return;

  const now = new Date();
  const event: ProposalViewEvent = {
    timestamp: now.toISOString(),
    ...(ip ? { ip } : {}),
    ...(userAgent ? { userAgent: userAgent.slice(0, 200) } : {}),
  };

  const prevEvents = (row.viewEvents as ProposalViewEvent[]) ?? [];
  const newEvents = [...prevEvents, event].slice(-20); // keep last 20

  await db
    .update(proposals)
    .set({
      viewCount: (row.viewCount ?? 0) + 1,
      viewEvents: newEvents,
      updatedAt: now,
      ...(!row.viewedAt ? { viewedAt: now } : {}),
      ...(row.status === "enviada" ? { status: "vista" as const } : {}),
    })
    .where(eq(proposals.id, row.id));

  // Solo la PRIMERA vista genera actividad — las siguientes ya viven en
  // viewEvents y ensuciarían el historial del cliente.
  if (!row.viewedAt) {
    await logClientActivity({
      ownerId: row.ownerId,
      clientId: row.clientId,
      type: "propuesta_vista",
      message: `El cliente abrió la propuesta: ${row.title}`,
    });
  }
}

export async function updateProposalActionStatus(
  proposal: Proposal & { id: string },
  action: "aceptada" | "rechazada",
): Promise<{ ok: boolean; reason?: string }> {
  const row = await resolveProposalRow(proposal.id);
  if (!row) return { ok: false, reason: "not_found" };

  if (row.status === "aceptada" || row.status === "rechazada") {
    return { ok: false, reason: "already_decided" };
  }

  const now = new Date();
  await db
    .update(proposals)
    .set({ status: action, acceptedAt: now, updatedAt: now })
    .where(eq(proposals.id, row.id));

  await logClientActivity({
    ownerId: row.ownerId,
    clientId: row.clientId,
    type: action === "aceptada" ? "propuesta_aceptada" : "propuesta_rechazada",
    message: `Propuesta ${action}: ${row.title}`,
  });

  return { ok: true };
}
