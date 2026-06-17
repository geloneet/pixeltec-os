import type { CRMClient, CRMProject } from "@/types/crm";

export interface ClientStats {
  projectsCount: number;
  totalTasks: number;
  openTasks: number;
  stopped: number;
  completed: number;
  pct: number;
}

export interface ClientBadge {
  label: string;
  colorClass: string;
}

export function deriveClientStats(client: CRMClient): ClientStats {
  let totalTasks = 0;
  let openTasks = 0;
  let stopped = 0;
  let completed = 0;

  for (const project of client.projects) {
    for (const task of project.tasks) {
      totalTasks++;
      if (task.status === "pendiente" || task.status === "proceso") openTasks++;
      if (task.status === "detenido") stopped++;
      if (task.status === "completado") completed++;
    }
  }

  return {
    projectsCount: client.projects.length,
    totalTasks,
    openTasks,
    stopped,
    completed,
    pct: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
  };
}

export function clientBadge(stats: ClientStats): ClientBadge {
  if (stats.stopped > 0) {
    return { label: "Atención", colorClass: "bg-red-500/15 text-red-400 border border-red-500/20" };
  }
  if (stats.totalTasks === 0) {
    return { label: "Sin tareas", colorClass: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/20" };
  }
  if (stats.openTasks > 0) {
    return { label: "En progreso", colorClass: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20" };
  }
  return { label: "Al día", colorClass: "bg-green-500/15 text-green-400 border border-green-500/20" };
}

// ── Project-level derivations ─────────────────────────────────────────────────

export interface ProjectStats {
  totalTasks: number;
  openTasks: number;
  stopped: number;
  completed: number;
  pct: number;
  lastTaskAt: string;
}

export function deriveProjectStats(project: CRMProject): ProjectStats {
  let totalTasks = 0;
  let openTasks = 0;
  let stopped = 0;
  let completed = 0;
  let lastTaskAt = project.createdAt;

  for (const task of project.tasks) {
    totalTasks++;
    if (task.status === "pendiente" || task.status === "proceso") openTasks++;
    if (task.status === "detenido") stopped++;
    if (task.status === "completado") completed++;
    if (task.createdAt > lastTaskAt) lastTaskAt = task.createdAt;
  }

  return {
    totalTasks,
    openTasks,
    stopped,
    completed,
    pct: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
    lastTaskAt,
  };
}

export function projectStatus(stats: ProjectStats): ClientBadge {
  if (stats.stopped > 0) {
    return { label: "Detenido", colorClass: "bg-red-500/15 text-red-400 border border-red-500/20" };
  }
  if (stats.totalTasks > 0 && stats.completed === stats.totalTasks) {
    return { label: "Completado", colorClass: "bg-green-500/15 text-green-400 border border-green-500/20" };
  }
  return { label: "Activo", colorClass: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20" };
}

// ── Activity feed ─────────────────────────────────────────────────────────────

export interface ActivityEvent {
  type: "client" | "project" | "task";
  label: string;
  context?: string;
  at: string;
}

export function buildActivityFeed(client: CRMClient, limit = 8): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  events.push({ type: "client", label: client.name, at: client.createdAt });

  for (const project of client.projects) {
    events.push({ type: "project", label: project.name, at: project.createdAt });
    for (const task of project.tasks) {
      events.push({ type: "task", label: task.name, context: project.name, at: task.createdAt });
    }
  }

  return events
    .sort((a, b) => (a.at > b.at ? -1 : 1))
    .slice(0, limit);
}
