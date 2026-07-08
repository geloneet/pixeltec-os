// Server-only helpers that derive the projection types used by /hoy and
// /proyectos. Fase 4: el núcleo CRM ya vive en Postgres (tabla `clients`,
// source='crm_blob') — se dejó de leer el blob `crm_data/{uid}` de Firestore.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getFullCrmData } from "@/lib/db/repos/crm-sync";
import type { CRMClient } from "@/types/crm";
import type { ActiveProject, RecentClient } from "@/lib/hoy/types";

/**
 * `uid` aquí sigue siendo el firebaseUid (bridge) que devuelve
 * `getSessionUid()` — se resuelve al ownerId real de Postgres antes de leer.
 */
export async function getCrmClients(uid: string): Promise<CRMClient[]> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.firebaseUid, uid)).limit(1);
  if (!user) return [];
  const data = await getFullCrmData(user.id);
  return data.clients;
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
