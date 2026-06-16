// Server-only helpers that read the single crm_data/{uid} document and derive
// the projection types used by /hoy and /proyectos. There are no clients/projects
// Firestore collections — all CRM data lives in this one document as nested arrays
// (written by the client SDK in CRMContext). lastActivityAt falls back to createdAt
// (the model has no updatedAt).
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CRMClient } from "@/types/crm";
import type { ActiveProject, RecentClient } from "@/lib/hoy/types";

/** Reads the single CRM blob document via the Admin SDK. */
export async function getCrmClients(uid: string): Promise<CRMClient[]> {
  const snap = await getAdminFirestore().collection("crm_data").doc(uid).get();
  if (!snap.exists) return [];
  return (snap.data()?.clients ?? []) as CRMClient[];
}

/** Flatten nested client.projects[] into ActiveProject rows, newest first. Pass `limit` to cap. */
export function deriveActiveProjects(
  clients: CRMClient[],
  limit?: number,
): ActiveProject[] {
  const projects: ActiveProject[] = [];
  for (const client of clients) {
    for (const p of client.projects ?? []) {
      projects.push({
        id: p.id,
        clientId: client.id,
        clientName: client.name,
        name: p.name,
        domain: p.domain,
        lastActivityAt: p.createdAt ?? null,
      });
    }
  }
  projects.sort((a, b) =>
    (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""),
  );
  return typeof limit === "number" ? projects.slice(0, limit) : projects;
}

/** Map clients to RecentClient rows, newest first. slug carries the id. Pass `limit` to cap. */
export function deriveRecentClients(
  clients: CRMClient[],
  limit?: number,
): RecentClient[] {
  const mapped = clients
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.id,
      lastActivityAt: c.createdAt ?? null,
    }))
    .sort((a, b) =>
      (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""),
    );
  return typeof limit === "number" ? mapped.slice(0, limit) : mapped;
}
