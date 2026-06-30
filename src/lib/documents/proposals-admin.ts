import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Proposal, ProposalViewEvent } from "@/types/documents";

const COL = "proposals";

export async function getProposalByToken(
  token: string,
): Promise<(Proposal & { id: string }) | null> {
  const db = getAdminFirestore();
  const snap = await db.collection(COL).where("publicToken", "==", token).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<Proposal, "id">) };
}

export async function logProposalView(
  proposal: Proposal & { id: string },
  ip?: string,
  userAgent?: string,
): Promise<void> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();

  const event: ProposalViewEvent = {
    timestamp: now,
    ...(ip ? { ip } : {}),
    ...(userAgent ? { userAgent: userAgent.slice(0, 200) } : {}),
  };

  const prevEvents: ProposalViewEvent[] = proposal.viewEvents ?? [];
  const newEvents = [...prevEvents, event].slice(-20); // keep last 20

  const updates: Partial<Proposal> = {
    viewCount: (proposal.viewCount ?? 0) + 1,
    viewEvents: newEvents,
    updatedAt: now,
  };

  if (!proposal.viewedAt) {
    updates.viewedAt = now;
  }
  if (proposal.status === "enviada") {
    updates.status = "vista";
  }

  await db.collection(COL).doc(proposal.id).update(updates);
}

export async function updateProposalActionStatus(
  proposal: Proposal & { id: string },
  action: "aceptada" | "rechazada",
): Promise<{ ok: boolean; reason?: string }> {
  if (proposal.status === "aceptada" || proposal.status === "rechazada") {
    return { ok: false, reason: "already_decided" };
  }

  const db = getAdminFirestore();
  const now = new Date().toISOString();

  const updates: Partial<Proposal> = {
    status: action,
    acceptedAt: now,
    updatedAt: now,
  };

  await db.collection(COL).doc(proposal.id).update(updates);
  return { ok: true };
}
