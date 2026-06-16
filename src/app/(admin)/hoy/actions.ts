"use server";

import { getSessionUid } from "@/lib/crypto-intel/auth";
import { getCurrentWeekTasks } from "@/lib/assistant/queries/tasks";
import { formatDateMX } from "@/lib/assistant/week-helpers";
import {
  getCrmClients,
  deriveActiveProjects,
  deriveRecentClients,
} from "@/lib/hoy/crm-data";
import type { TodayData, TodayTask } from "@/lib/hoy/types";

const DONE_STATUSES = new Set(["completed", "cancelled"]);

/**
 * Assembles the Hoy dashboard payload for the signed-in user.
 * Tasks come from the real `assistantTasks` collection; projects and
 * clients are derived from the single `crm_data/{uid}` document
 * (there are no `clients`/`projects` collections). Returns null when
 * there is no valid session — the page redirects to /login.
 */
export async function getTodayData(): Promise<TodayData | null> {
  const uid = await getSessionUid();
  if (!uid) return null;

  const now = new Date();
  const [tasks, clients] = await Promise.all([
    getTodayTasks(uid, now),
    getCrmClients(uid),
  ]);

  return {
    tasks,
    projects: deriveActiveProjects(clients, 6),
    clients: deriveRecentClients(clients, 5),
    asOf: now.toISOString(),
  };
}

/** Today's tasks — reuse the week query, filter to today in MX TZ (no new index). */
async function getTodayTasks(uid: string, now: Date): Promise<TodayTask[]> {
  const weekTasks = await getCurrentWeekTasks(uid);
  const todayKey = formatDateMX(now);
  return weekTasks
    .filter((t) => formatDateMX(new Date(t.startsAt)) === todayKey)
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      category: t.category,
      startsAt: t.startsAt,
      durationMin: t.durationMin,
      isOverdue: new Date(t.startsAt) < now && !DONE_STATUSES.has(t.status),
    }));
}
