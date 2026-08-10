"use server";

import { getSessionUserId } from "@/lib/auth/session";
import { getFullCrmData } from "@/lib/db/repos/crm-sync";
import { listPixelforgeProjectsByOwner } from "@/lib/db/repos/pixelforge";
import { listDefinitionsByOwner } from "@/lib/db/repos/definitions";
import {
  deriveActiveProjects,
  deriveAllProjects,
  deriveRecentClients,
  deriveActivitySeries,
} from "@/lib/hoy/crm-data";
import type { TodayData } from "@/lib/hoy/types";

/**
 * Arma el payload del panel Hoy para el usuario autenticado.
 *
 * Proyectos y clientes salen de la tabla `clients` de Postgres, filtrada por
 * `owner_id`. Devuelve null cuando no hay sesión: la página redirige a /login.
 *
 * La identidad es `users.id`. Antes se usaba el `firebaseUid` puente, lo que
 * dejaba fuera a toda cuenta creada tras la migración: sin puente esta función
 * devolvía null y la página rebotaba al login en bucle, pese a haber sesión.
 *
 * Rediseño de distribución (excepción al freeze de v1.0 — ver PixelTEC OS.md
 * en NeuroPIXEL): los KPIs y la gráfica de actividad salen de datos que
 * `getFullCrmData` YA cargaba y el dashboard descartaba (`tools`, `streak`,
 * `sessions`), más `deriveAllProjects` (mismo patrón que `getAllActiveProjects`
 * en `proyectos/actions.ts`) para no omitir proyectos PixelForge/Definición.
 * Cero queries nuevas.
 */
export async function getTodayData(): Promise<TodayData | null> {
  const ownerId = await getSessionUserId();
  if (!ownerId) return null;

  const now = new Date();
  const [{ clients, tools, streak, sessions }, pixelforgeProjects, definitions] =
    await Promise.all([
      getFullCrmData(ownerId),
      listPixelforgeProjectsByOwner(ownerId),
      listDefinitionsByOwner(ownerId),
    ]);

  const allProjects = deriveAllProjects(clients, pixelforgeProjects, definitions);
  const openTasks = clients
    .flatMap((c) => c.projects ?? [])
    .flatMap((p) => p.tasks ?? [])
    .filter(
      (t) =>
        t.status === "pendiente" ||
        t.status === "en_progreso" ||
        t.status === "en_revision"
    ).length;

  return {
    projects: deriveActiveProjects(clients, 6),
    clients: deriveRecentClients(clients, 5),
    stats: {
      activeProjects: allProjects.length,
      clients: clients.length,
      openTasks,
      streak,
      sessions: sessions.length,
      tools: tools.length,
    },
    activity: {
      daily: deriveActivitySeries(sessions, "daily", now),
      weekly: deriveActivitySeries(sessions, "weekly", now),
      monthly: deriveActivitySeries(sessions, "monthly", now),
    },
    asOf: now.toISOString(),
  };
}
