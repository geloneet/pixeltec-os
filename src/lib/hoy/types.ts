/**
 * Hoy module types — Patch v2 (no ProjectHealth, no ClientPending, no scoring)
 *
 * ActiveProject — a project with recent activity (no health/semáforo)
 * RecentClient  — a client with recent document activity
 * TodayData    — the complete payload returned by the Hoy data action
 */

export interface ActiveProject {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  domain: string;
  /** ISO 8601 string — updatedAt del documento proyecto. null if field absent. */
  lastActivityAt: string | null;
}

export interface RecentClient {
  id: string;
  name: string;
  slug: string;
  /** ISO 8601 string — updatedAt del documento cliente. null if field absent. */
  lastActivityAt: string | null;
}

export interface TodayData {
  projects: ActiveProject[];
  clients: RecentClient[];
  /** ISO 8601 string — timestamp of when this data was assembled (server-side) */
  asOf: string;
}
