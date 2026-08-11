"use client";

/**
 * Tarjeta de proyecto compartida (ADR-0035): antes vivía duplicada casi 1:1
 * en ClientDetail y ProyectosTab (divergían solo en el label del botón).
 */
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CRMProject } from "@/types/crm";
import { projectStatus, type ProjectStats } from "@/lib/crm/client-stats";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ModalPayload = { type: string; data?: Record<string, string> } | null;

function relativeTime(dateStr: string): string {
  try { return formatDistanceToNow(new Date(dateStr), { locale: es, addSuffix: true }); }
  catch { return "—"; }
}

function exactDate(dateStr: string): string {
  try { return format(new Date(dateStr), "d MMM yyyy, HH:mm", { locale: es }); }
  catch { return dateStr; }
}

interface ProjectCardProps {
  project: CRMProject;
  stats: ProjectStats;
  clientId: string;
  navigateToProject: (cid: string, pid: string) => void;
  setModal: (m: ModalPayload) => void;
  openLabel?: string;
}

export function ProjectCardShared({ project: p, stats, clientId, navigateToProject, setModal, openLabel = "Abrir" }: ProjectCardProps) {
  const status = projectStatus(stats);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:bg-secondary/40">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
          {p.domain && <p className="truncate text-[11px] text-muted-foreground">{p.domain}</p>}
        </div>
        <span className={cn("flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", status.colorClass)}>
          {status.label}
        </span>
      </div>

      {stats.totalTasks > 0 ? (
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">{stats.pct}% completado</span>
            <span className="text-muted-foreground">{stats.completed}/{stats.totalTasks} tareas</span>
          </div>
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full transition-all", stats.pct >= 100 ? "bg-green-500" : "bg-cyan-500")}
              style={{ width: `${stats.pct}%` }}
            />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            {stats.openTasks > 0 && <span>{stats.openTasks} abierta{stats.openTasks !== 1 ? "s" : ""}</span>}
            {stats.stopped > 0 && <span className="text-red-400">{stats.stopped} detenida{stats.stopped !== 1 ? "s" : ""}</span>}
          </div>
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-muted-foreground italic">Sin tareas</p>
      )}

      <div className="mt-auto flex items-center justify-between">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default text-[10px] text-muted-foreground">
                Últ. alta {relativeTime(stats.lastTaskAt)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="border-border bg-card text-foreground text-xs">
              {exactDate(stats.lastTaskAt)}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigateToProject(clientId, p.id)}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            {openLabel}
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
            className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}
