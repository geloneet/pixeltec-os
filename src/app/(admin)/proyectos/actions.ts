"use server";

import { getSessionUid } from "@/lib/auth/session";
import { getCrmClients, deriveActiveProjects } from "@/lib/hoy/crm-data";
import type { ActiveProject } from "@/lib/hoy/types";

/**
 * All active projects for the signed-in user, newest first (uncapped).
 * Derived from the crm_data/{uid} document. Returns [] when there is no session.
 */
export async function getAllActiveProjects(): Promise<ActiveProject[]> {
  const uid = await getSessionUid();
  if (!uid) return [];
  return deriveActiveProjects(await getCrmClients(uid));
}
