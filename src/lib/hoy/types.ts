/**
 * Hoy module types — Patch v2 (no ProjectHealth, no ClientPending, no scoring)
 *
 * ActiveProject — a project with recent activity (no health/semáforo)
 * RecentClient  — a client with recent document activity
 * TodayData    — the complete payload returned by the Hoy data action
 */

export type ActiveProjectKind = "crm" | "definicion" | "pixelforge";

export interface ActiveProject {
  id: string;
  /** Fuente de origen — distingue proyecto CRM clásico, Definición o PixelForge. */
  kind: ActiveProjectKind;
  /** Ruta de detalle correcta para este tipo de proyecto (difiere por kind). */
  href: string;
  clientId: string;
  clientName: string;
  name: string;
  domain: string;
  /** Estación actual del pipeline (definición/pixelforge). null en proyectos CRM. */
  station: string | null;
  /** Estado del proyecto (definición/pixelforge). null en proyectos CRM. */
  status: string | null;
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
