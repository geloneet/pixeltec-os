"use server";

import { getSessionUserId } from "@/lib/auth/session";
import {
  getCrmClientsByOwnerId,
  deriveActiveProjects,
  deriveRecentClients,
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
 */
export async function getTodayData(): Promise<TodayData | null> {
  const ownerId = await getSessionUserId();
  if (!ownerId) return null;

  const now = new Date();
  const clients = await getCrmClientsByOwnerId(ownerId);

  return {
    projects: deriveActiveProjects(clients, 6),
    clients: deriveRecentClients(clients, 5),
    asOf: now.toISOString(),
  };
}
