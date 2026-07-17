"use server";

import { auth } from "@/lib/auth/config";
import { getCrmClients, deriveAllProjects } from "@/lib/hoy/crm-data";
import { listPixelforgeProjectsByOwner } from "@/lib/db/repos/pixelforge";
import { listDefinitionsByOwner } from "@/lib/db/repos/definitions";
import type { ActiveProject } from "@/lib/hoy/types";

/**
 * All active projects for the signed-in user, newest first (uncapped).
 * Une las tres fuentes reales: CRM clásico, Definición de Proyecto y
 * PixelForge — antes solo se leía CRM y una cuenta con solo proyectos
 * PixelForge/Definición veía "Todos" vacío. Returns [] cuando no hay sesión.
 *
 * `session.user.firebaseUid` (bridge) alimenta `getCrmClients`, que traduce
 * internamente a `users.id`; `session.user.id` ya ES el `users.id` real de
 * Postgres que esperan los otros dos repos — una sola llamada a `auth()`
 * cubre ambos, sin queries extra (mismo patrón que las páginas de listado
 * de Definición/PixelForge).
 */
export async function getAllActiveProjects(): Promise<ActiveProject[]> {
  const session = await auth();
  const uid = session?.user?.firebaseUid ?? null;
  const ownerId = session?.user?.id ?? null;
  if (!uid || !ownerId) return [];

  const [clients, pixelforgeProjects, definitions] = await Promise.all([
    getCrmClients(uid),
    listPixelforgeProjectsByOwner(ownerId),
    listDefinitionsByOwner(ownerId),
  ]);

  return deriveAllProjects(clients, pixelforgeProjects, definitions);
}
