"use server";

import { getSessionUid } from "@/lib/crypto-intel/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getCurrentWeekTasks } from "@/lib/assistant/queries/tasks";
import { formatDateMX } from "@/lib/assistant/week-helpers";
import type { CRMClient } from "@/types/crm";
import type {
  TodayData,
  TodayTask,
  ActiveProject,
  RecentClient,
} from "@/lib/hoy/types";

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
    projects: deriveActiveProjects(clients),
    clients: deriveRecentClients(clients),
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

/** Reads the single CRM blob document via the Admin SDK. */
async function getCrmClients(uid: string): Promise<CRMClient[]> {
  const snap = await getAdminFirestore().collection("crm_data").doc(uid).get();
  if (!snap.exists) return [];
  return (snap.data()?.clients ?? []) as CRMClient[];
}

/** Flatten nested client.projects[]; lastActivityAt falls back to createdAt. */
function deriveActiveProjects(clients: CRMClient[]): ActiveProject[] {
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
  // Sort most-recently-created first; cap at 6
  return projects
    .sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""))
    .slice(0, 6);
}

/** Map clients; slug carries the id (no slug field in the model) — panel links by id. */
function deriveRecentClients(clients: CRMClient[]): RecentClient[] {
  return clients
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.id,
      lastActivityAt: c.createdAt ?? null,
    }))
    .sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""))
    .slice(0, 5);
}
