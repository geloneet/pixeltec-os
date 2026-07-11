"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CRMClient, CRMProject } from "@/types/crm";
import {
  deriveProjectStats,
  projectStatus,
  type ProjectStats,
} from "@/lib/crm/client-stats";
import { cn } from "@/lib/utils";

type ModalPayload = { type: string; data?: Record<string, string> } | null;

interface Props {
  client: CRMClient;
  navigateToProject: (clientId: string, projectId: string) => void;
  setModal: (m: ModalPayload) => void;
}

function relativeTime(dateStr: string): string {
  try { return formatDistanceToNow(new Date(dateStr), { locale: es, addSuffix: true }); }
  catch { return "—"; }
}

function exactDate(dateStr: string): string {
  try { return format(new Date(dateStr), "d MMM yyyy, HH:mm", { locale: es }); }
  catch { return dateStr; }
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

interface CardProps {
  project: CRMProject;
  stats: ProjectStats;
  clientId: string;
  navigateToProject: (cid: string, pid: string) => void;
  setModal: (m: ModalPayload) => void;
}

function ProjectCard({ project: p, stats, clientId, navigateToProject, setModal }: CardProps) {
  const status = projectStatus(stats);

  return (
    <div className="flex flex-col rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 transition-all duration-150 hover:border-white/[0.10] hover:bg-white/[0.03]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">{p.name}</p>
          {p.domain && <p className="truncate text-[11px] text-zinc-500">{p.domain}</p>}
        </div>
        <span className={cn("flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", status.colorClass)}>
          {status.label}
        </span>
      </div>

      {stats.totalTasks > 0 ? (
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-zinc-500">{stats.pct}% completado</span>
            <span className="text-zinc-600">{stats.completed}/{stats.totalTasks} tareas</span>
          </div>
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={cn("h-full rounded-full transition-all", stats.pct >= 100 ? "bg-green-500" : "bg-cyan-500")}
              style={{ width: `${stats.pct}%` }}
            />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            {stats.openTasks > 0 && <span>{stats.openTasks} abierta{stats.openTasks !== 1 ? "s" : ""}</span>}
            {stats.stopped > 0 && <span className="text-red-400">{stats.stopped} detenida{stats.stopped !== 1 ? "s" : ""}</span>}
          </div>
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-zinc-600 italic">Sin tareas</p>
      )}

      <div className="mt-auto flex items-center justify-between">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default text-[10px] text-zinc-500">
                Últ. alta {relativeTime(stats.lastTaskAt)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="border-zinc-800 bg-zinc-900 text-zinc-300 text-xs">
              {exactDate(stats.lastTaskAt)}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigateToProject(clientId, p.id)}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
          >
            Abrir
          </button>
          <button
            onClick={() => setModal({
              type: "editProject",
              data: {
                id: p.id,
                name: p.name,
                domain: p.domain,
                budget: p.budget.toString(),
                annual: p.annual.toString(),
                budgetIva: p.budgetIva,
                annualIva: p.annualIva,
                tech: p.tech,
                accounts: p.accounts,
                guides: p.guides,
              },
            })}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProyectosTab ──────────────────────────────────────────────────────────────

export function ProyectosTab({ client, navigateToProject, setModal }: Props) {
  const projectsWithStats = useMemo(
    () => client.projects.map(p => ({ project: p, stats: deriveProjectStats(p) })),
    [client.projects],
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Proyectos</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{client.projects.length} proyecto{client.projects.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/proyectos/definicion/nueva?client=${encodeURIComponent(client.id)}&name=${encodeURIComponent(client.name)}`}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Nuevo Proyecto
          </Link>
          <button
            onClick={() => setModal({ type: "addProject", data: { clientId: client.id } })}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Proyecto nuevo con avance
          </button>
        </div>
      </div>

      {client.projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium text-zinc-400 mb-1">Sin proyectos</p>
          <p className="text-xs text-zinc-600">Agrega el primer proyecto para este cliente.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projectsWithStats.map(({ project, stats }) => (
            <ProjectCard
              key={project.id}
              project={project}
              stats={stats}
              clientId={client.id}
              navigateToProject={navigateToProject}
              setModal={setModal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
