import type { CRMClient } from "@/types/crm";

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
