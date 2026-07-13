"use server";

import { getSessionUid } from "@/lib/auth/session";
import {
  getCrmClients,
  deriveActiveProjects,
  deriveRecentClients,
} from "@/lib/hoy/crm-data";
import type { TodayData } from "@/lib/hoy/types";

/**
 * Assembles the Hoy dashboard payload for the signed-in user.
 * Projects and clients are derived from the single `crm_data/{uid}`
 * document (there are no `clients`/`projects` collections). Returns null
 * when there is no valid session — the page redirects to /login.
 */
export async function getTodayData(): Promise<TodayData | null> {
  const uid = await getSessionUid();
  if (!uid) return null;

  const now = new Date();
  const clients = await getCrmClients(uid);

  return {
    projects: deriveActiveProjects(clients, 6),
    clients: deriveRecentClients(clients, 5),
    asOf: now.toISOString(),
  };
}
