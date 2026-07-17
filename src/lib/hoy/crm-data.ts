// Server-only helpers that derive the projection types used by /hoy and
// /proyectos. Fase 4: el núcleo CRM ya vive en Postgres (tabla `clients`,
// source='crm_blob') — se dejó de leer el blob `crm_data/{uid}` de Firestore.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getFullCrmData } from "@/lib/db/repos/crm-sync";
import type { CRMClient } from "@/types/crm";
import type { ActiveProject, RecentClient } from "@/lib/hoy/types";
import type { PixelforgeProjectListItem } from "@/lib/db/repos/pixelforge";
import type { DefinitionListItem } from "@/lib/db/repos/definitions";

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
        kind: "crm",
        href: `/proyectos/${p.id}`,
        clientId: client.id,
        clientName: client.name,
        name: p.name,
        domain: p.domain,
        station: null,
        status: null,
        lastActivityAt: p.createdAt ?? null,
      });
    }
  }
  projects.sort((a, b) =>
    (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""),
  );
  return typeof limit === "number" ? projects.slice(0, limit) : projects;
}

/**
 * Une las tres fuentes de proyectos del mismo owner (CRM clásico, Definición
 * de Proyecto y PixelForge) en una sola lista, newest first, sin doble
 * conteo. Cada fuente vive en una tabla física distinta — no hay solapamiento
 * real de ids entre ellas — pero se deduplica por `kind:id` como salvaguarda.
 *
 * Antes de esto, "Todos" (`getAllActiveProjects`) solo llamaba
 * `deriveActiveProjects` y por eso una cuenta con únicamente proyectos
 * PixelForge/Definición veía la lista vacía.
 */
export function deriveAllProjects(
  clients: CRMClient[],
  pixelforgeProjects: PixelforgeProjectListItem[],
  definitions: DefinitionListItem[],
): ActiveProject[] {
  const seen = new Set<string>();
  const all: ActiveProject[] = [];

  const push = (project: ActiveProject) => {
    const key = `${project.kind}:${project.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    all.push(project);
  };

  for (const project of deriveActiveProjects(clients)) {
    push(project);
  }

  for (const p of pixelforgeProjects) {
    push({
      id: p.id,
      kind: "pixelforge",
      href: `/proyectos/pixelforge/${p.id}/${p.currentStation}`,
      clientId: p.clientId,
      clientName: p.clientName ?? "Cliente",
      name: p.title,
      domain: "",
      station: p.currentStation,
      status: p.status,
      lastActivityAt: p.updatedAt.toISOString(),
    });
  }

  for (const d of definitions) {
    push({
      id: d.id,
      kind: "definicion",
      href: `/proyectos/definicion/${d.id}`,
      clientId: d.clientId,
      clientName: d.clientName ?? "Cliente",
      name: d.title,
      domain: "",
      station: d.currentStation,
      status: d.status,
      lastActivityAt: d.updatedAt.toISOString(),
    });
  }

  all.sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));
  return all;
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
