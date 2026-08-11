import { format, formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";
import type { CRMClient, ClientNextAction } from "@/types/crm";
import {
  deriveProjectStats,
  projectStatus,
  type ClientStats,
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
 * (ADR-0035) y viaja en el blob solo de lectura; `now` se inyecta para que
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

// ── Atención y archivo ───────────────────────────────────────────────────────

/**
 * «Requiere atención»: tareas detenidas, próxima acción vencida, o cliente
 * activo sin próxima acción registrada (un activo sin siguiente paso es un
 * cliente a la deriva).
 */
export function clientNeedsAttention(client: CRMClient, stats: ClientStats, now: Date): boolean {
  if (stats.stopped > 0) return true;
  const dueAt = client.nextAction?.dueAt;
  if (dueAt) {
    const due = new Date(dueAt);
    if (!Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) return true;
  }
  if ((client.crmStatus ?? "prospecto") === "activo" && !client.nextAction) return true;
  return false;
}

/** Archivado = fuera del trabajo diario (`pausado` o `cerrado`, ADR-0035). */
export function isArchivedClient(client: CRMClient): boolean {
  return client.crmStatus === "pausado" || client.crmStatus === "cerrado";
}

// ── Última actividad ─────────────────────────────────────────────────────────

/**
 * Fallback sintético para clientes sin filas en client_activity (histórico
 * anterior a ADR-0035): lo más reciente entre el alta del cliente y la de
 * sus proyectos. Compara ISO strings (orden lexicográfico = cronológico).
 */
export function syntheticLastActivity(client: CRMClient): string {
  let last = client.createdAt;
  for (const p of client.projects) {
    if (p.createdAt > last) last = p.createdAt;
  }
  return last;
}

/** «hace 3 días» — relativo, para la columna Última actividad. */
export function lastActivityLabel(iso: string | null, now: Date): string {
  if (!iso) return "—";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  return formatDistanceStrict(at, now, { locale: es, addSuffix: true });
}

// ── Filtros, orden y búsqueda (en memoria: ≤ decenas de filas) ───────────────

export const CLIENTS_FILTERS = ["todos", "atencion", "sin-proyecto", "archivados"] as const;
export type ClientsFilter = (typeof CLIENTS_FILTERS)[number];

export const CLIENTS_SORTS = ["atencion", "actividad", "nuevos", "nombre"] as const;
export type ClientsSort = (typeof CLIENTS_SORTS)[number];

/** Valores desconocidos (URL manipulada o vieja) degradan al default. */
export function parseClientsFilter(value: string | null): ClientsFilter {
  return (CLIENTS_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as ClientsFilter)
    : "todos";
}

export function parseClientsSort(value: string | null): ClientsSort {
  return (CLIENTS_SORTS as readonly string[]).includes(value ?? "")
    ? (value as ClientsSort)
    : "atencion";
}

export interface ClientListEntry {
  client: CRMClient;
  stats: ClientStats;
  attention: boolean;
  /** ISO ya resuelta: fila real de client_activity o fallback sintético. */
  lastActivityAt: string;
}

/**
 * `archivados` es la única vista que los muestra; el resto de filtros los
 * EXCLUYE (pausado/cerrado son ruido en el trabajo diario).
 */
export function applyClientsFilter<T extends ClientListEntry>(entries: T[], filter: ClientsFilter): T[] {
  if (filter === "archivados") return entries.filter((e) => isArchivedClient(e.client));
  const visible = entries.filter((e) => !isArchivedClient(e.client));
  if (filter === "atencion") return visible.filter((e) => e.attention);
  if (filter === "sin-proyecto") return visible.filter((e) => e.client.projects.length === 0);
  return visible;
}

/** Búsqueda por nombre, contacto, ubicación, teléfono, email y proyectos. */
export function matchesClientQuery(client: CRMClient, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  return (
    client.name.toLowerCase().includes(q) ||
    (client.contactName?.toLowerCase().includes(q) ?? false) ||
    client.location.toLowerCase().includes(q) ||
    client.phone.toLowerCase().includes(q) ||
    client.email.toLowerCase().includes(q) ||
    client.projects.some((p) => p.name.toLowerCase().includes(q))
  );
}

/** Comparación cronológica de ISO strings (lexicográfica, sin collation). */
function isoCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Órdenes del directorio. `atencion` (default): quienes requieren atención
 * primero, entre ellos el vencimiento más antiguo antes (sin fecha al final
 * del bloque), y como desempate la última actividad descendente; nombre como
 * desempate final estable.
 */
export function sortClientsEntries<T extends ClientListEntry>(entries: T[], sort: ClientsSort): T[] {
  const byName = (a: ClientListEntry, b: ClientListEntry) =>
    a.client.name.localeCompare(b.client.name, "es");
  const byActivityDesc = (a: ClientListEntry, b: ClientListEntry) =>
    isoCompare(b.lastActivityAt, a.lastActivityAt);

  const sorted = [...entries];
  if (sort === "nombre") {
    sorted.sort(byName);
  } else if (sort === "nuevos") {
    sorted.sort((a, b) => isoCompare(b.client.createdAt, a.client.createdAt) || byName(a, b));
  } else if (sort === "actividad") {
    sorted.sort((a, b) => byActivityDesc(a, b) || byName(a, b));
  } else {
    sorted.sort((a, b) => {
      if (a.attention !== b.attention) return a.attention ? -1 : 1;
      if (a.attention && b.attention) {
        const dueA = a.client.nextAction?.dueAt ?? null;
        const dueB = b.client.nextAction?.dueAt ?? null;
        if (dueA !== dueB) {
          if (dueA === null) return 1;
          if (dueB === null) return -1;
          const cmp = isoCompare(dueA, dueB);
          if (cmp !== 0) return cmp;
        }
      }
      return byActivityDesc(a, b) || byName(a, b);
    });
  }
  return sorted;
}

// ── Métricas del header ──────────────────────────────────────────────────────

export interface DirectoryMetrics {
  /** Clientes con crmStatus === "activo" (excluye archivados por definición). */
  activeClients: number;
  /** Suma de proyectos en estado Activo de clientes no archivados. */
  activeProjects: number;
  /** Clientes no archivados que requieren atención. */
  attention: number;
}

export function deriveDirectoryMetrics(entries: ClientListEntry[]): DirectoryMetrics {
  const visible = entries.filter((e) => !isArchivedClient(e.client));
  return {
    activeClients: visible.filter((e) => e.client.crmStatus === "activo").length,
    activeProjects: visible.reduce((sum, e) => sum + activeProjectsCount(e.client), 0),
    attention: visible.filter((e) => e.attention).length,
  };
}
