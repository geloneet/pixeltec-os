"use server";

import { getSessionUserId } from "@/lib/auth/session";
import { getCrmClientsByOwnerId, deriveAllProjects } from "@/lib/hoy/crm-data";
import { listPixelforgeProjectsByOwner } from "@/lib/db/repos/pixelforge";
import { listDefinitionsByOwner } from "@/lib/db/repos/definitions";
import type { ActiveProject } from "@/lib/hoy/types";

/**
 * All active projects for the signed-in user, newest first (uncapped).
 * Une las tres fuentes reales: CRM clásico, Definición de Proyecto y
 * PixelForge — antes solo se leía CRM y una cuenta con solo proyectos
 * PixelForge/Definición veía "Todos" vacío. Returns [] cuando no hay sesión.
 *
 * Las tres fuentes se consultan por `users.id`. Antes esta función exigía
 * ADEMÁS el `firebaseUid` puente para alimentar el CRM, y abortaba con `[]` si
 * faltaba — así que una cuenta creada tras la migración veía "Todos" vacío
 * aunque PixelForge y Definición, que ya usaban `ownerId`, sí tuvieran datos.
 */
export async function getAllActiveProjects(): Promise<ActiveProject[]> {
  const ownerId = await getSessionUserId();
  if (!ownerId) return [];

  const [clients, pixelforgeProjects, definitions] = await Promise.all([
    getCrmClientsByOwnerId(ownerId),
    listPixelforgeProjectsByOwner(ownerId),
    listDefinitionsByOwner(ownerId),
  ]);

  return deriveAllProjects(clients, pixelforgeProjects, definitions);
}
