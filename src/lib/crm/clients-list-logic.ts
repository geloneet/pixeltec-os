import { format, formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";
import type { CRMClient, ClientNextAction } from "@/types/crm";
import {
  deriveProjectStats,
  projectStatus,
} from "./client-stats";

/**
 * Lógica PURA del directorio de Clientes (rediseño 2026-08-05, patrón
 * blog-admin-logic): chips y derivaciones por fila, separadas de la vista
 * para poder testearse sin DOM. La fila deja de mostrar contadores crudos
 * (% avance, tareas, "cliente desde") y pasa a señales del workspace:
 * estado comercial, próxima acción y proyectos activos.
 */

// ── Chip «Próxima acción» ────────────────────────────────────────────────────

export interface NextActionChip {
  label: string;
  /** Nota bajo el label: fecha corta o «Vencido hace X». */
  detail: string | null;
  tone: "muted" | "default" | "overdue";
}

/**
 * Deriva el chip de próxima acción de la fila. `nextAction` es server-owned
 * (ADR-0034) y viaja en el blob solo de lectura; `now` se inyecta para que
 * la función sea determinista en tests.
 */
export function nextActionChip(
  nextAction: ClientNextAction | null | undefined,
  now: Date
): NextActionChip {
  if (!nextAction) {
    return { label: "Sin próxima acción", detail: null, tone: "muted" };
  }
  if (!nextAction.dueAt) {
    return { label: nextAction.label, detail: null, tone: "default" };
  }
  const due = new Date(nextAction.dueAt);
  if (Number.isNaN(due.getTime())) {
    return { label: nextAction.label, detail: null, tone: "default" };
  }
  if (due.getTime() < now.getTime()) {
    return {
      label: nextAction.label,
      detail: `Vencido hace ${formatDistanceStrict(due, now, { locale: es })}`,
      tone: "overdue",
    };
  }
  return {
    label: nextAction.label,
    detail: format(due, "d MMM", { locale: es }),
    tone: "default",
  };
}

// ── Columna de proyectos ─────────────────────────────────────────────────────

export interface ActiveProjectsInfo {
  /** Proyectos cuyo estado derivado es «Activo» (ni detenido ni completado). */
  count: number;
  /** «N activos» o «Sin proyecto». */
  label: string;
  hasProjects: boolean;
}

/** Proyectos del cliente en estado «Activo» según `projectStatus` (taxonomía
 *  canónica Detenido/Completado/Activo del workspace). */
export function activeProjectsCount(client: CRMClient): number {
  return client.projects.filter(
    (p) => projectStatus(deriveProjectStats(p)).label === "Activo"
  ).length;
}

/** El total histórico ya no se muestra: la fila responde «¿hay trabajo vivo?». */
export function activeProjectsInfo(client: CRMClient): ActiveProjectsInfo {
  if (client.projects.length === 0) {
    return { count: 0, label: "Sin proyecto", hasProjects: false };
  }
  const count = activeProjectsCount(client);
  return {
    count,
    label: `${count} activo${count === 1 ? "" : "s"}`,
    hasProjects: true,
  };
}
