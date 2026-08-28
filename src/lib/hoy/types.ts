/**
 * Hoy module types — WO-2026-00132: Inicio comercial (sin infra, sin
 * métricas de sesiones/tools/racha). Los proyectos ahora son `ProjectRow`
 * (@/lib/projects/queries, tabla `projects` real) — se retiró `ActiveProject`
 * (las 3 fuentes viejas: CRM blob, Definición, PixelForge).
 */
import type { ProjectRow } from "@/lib/projects/queries";

export interface RecentClient {
  id: string;
  name: string;
  slug: string;
  /** ISO 8601 string — updatedAt del documento cliente. null if field absent. */
  lastActivityAt: string | null;
}

export interface TodayStats {
  activeProjects: number;
  clients: number;
  pendingQuotes: number;
  expiringQuotes: number;
}

export interface TodayData {
  projects: ProjectRow[];
  clients: RecentClient[];
  /** KPIs del dashboard — vistazo comercial. */
  stats: TodayStats;
  /** ISO 8601 string — timestamp of when this data was assembled (server-side) */
  asOf: string;
}
