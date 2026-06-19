"use client";

import { useState, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FolderKanban,
  ListTodo,
  CheckCircle2,
  PauseCircle,
  MoreHorizontal,
  ArrowLeft,
  CircleDot,
  FileText,
} from "lucide-react";
import type { CRMClient, CRMProject } from "@/types/crm";
import {
  deriveClientStats,
  deriveProjectStats,
  projectStatus,
  buildActivityFeed,
  type ProjectStats,
  type ClientBadge,
} from "@/lib/crm/client-stats";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#0EA5E9", "#3b82f6", "#ef4444", "#f59e0b",
  "#10b981", "#ec4899", "#8b5cf6", "#06b6d4",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function relativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { locale: es, addSuffix: true });
  } catch {
    return "—";
  }
}

function exactDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "d MMM yyyy, HH:mm", { locale: es });
  } catch {
    return dateStr;
  }
}

// ── Header badge (client-level) ───────────────────────────────────────────────

function clientDetailBadge(stopped: number, totalTasks: number): ClientBadge {
  if (stopped > 0) {
    return { label: "Atención requerida", colorClass: "bg-red-500/15 text-red-400 border border-red-500/20" };
  }
  if (totalTasks === 0) {
    return { label: "Sin tareas", colorClass: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/20" };
  }
  return { label: "Activo", colorClass: "bg-green-500/15 text-green-400 border border-green-500/20" };
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: CRMProject;
  stats: ProjectStats;
  clientId: string;
  navigateToProject: (cid: string, pid: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
}

function ProjectCard({ project: p, stats, clientId, navigateToProject, setModal }: ProjectCardProps) {
  const status = projectStatus(stats);

  return (
    <div className="flex flex-col rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 transition-all duration-150 hover:border-white/[0.10] hover:bg-white/[0.03]">
      {/* Card header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">{p.name}</p>
          {p.domain && (
            <p className="truncate text-[11px] text-zinc-500">{p.domain}</p>
          )}
        </div>
        <span className={cn("flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", status.colorClass)}>
          {status.label}
        </span>
      </div>

      {/* Progress */}
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

      {/* Footer */}
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
            Ver
          </button>
          <button
            onClick={() =>
              setModal({
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
              })
            }
            className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ClientDetailProps {
  client: CRMClient;
  setView: (v: "asistente" | "clients" | "client" | "project" | "search") => void;
  navigateToProject: (cid: string, pid: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
  deleteClient: (id: string) => void;
}

// ── ClientDetail ──────────────────────────────────────────────────────────────

export function ClientDetail({ client, setView, navigateToProject, setModal, deleteClient }: ClientDetailProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDeleteConfirmed = () => {
    deleteClient(client.id);
    setView("clients");
  };

  const color = avatarColor(client.name);
  const clientStats = useMemo(() => deriveClientStats(client), [client]);
  const projectsWithStats = useMemo(
    () => client.projects.map(p => ({ project: p, stats: deriveProjectStats(p) })),
    [client.projects]
  );
  const feed = useMemo(() => buildActivityFeed(client, 8), [client]);
  const headerBadge = clientDetailBadge(clientStats.stopped, clientStats.totalTasks);
  const contact = [client.location, client.phone].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">

      {/* Breadcrumb */}
      <button
        onClick={() => setView("clients")}
        className="mb-5 flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Clientes
      </button>

      {/* ── SECCIÓN 1: HEADER ────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center gap-4 rounded-xl border border-white/[0.06] bg-zinc-900/20 p-5">
        <span
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initials(client.name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-zinc-100">{client.name}</h2>
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", headerBadge.colorClass)}>
              {headerBadge.label}
            </span>
          </div>
          {contact && <p className="mt-0.5 text-sm text-zinc-500">{contact}</p>}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() =>
              setModal({
                type: "editClient",
                data: {
                  id: client.id,
                  name: client.name,
                  email: client.email,
                  phone: client.phone,
                  location: client.location,
                  notes: client.notes,
                },
              })
            }
            className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:border-white/[0.10] hover:text-zinc-200"
          >
            Editar
          </button>
          <button
            onClick={() => setModal({ type: "addProject" })}
            className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
          >
            + Proyecto
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-zinc-900/40 text-zinc-500 transition-all hover:border-white/[0.10] hover:text-zinc-300 focus-visible:outline-none">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 border-zinc-800/60 bg-zinc-900/95 backdrop-blur-xl">
              <DropdownMenuItem
                className="cursor-pointer text-sm text-red-400 focus:bg-red-500/10 focus:text-red-300"
                onSelect={() => setDeleteOpen(true)}
              >
                Eliminar cliente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── SECCIÓN 2: SNAPSHOT ──────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Proyectos */}
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
          <FolderKanban className="mb-2 h-4 w-4 text-cyan-400" strokeWidth={1.75} />
          <p className="tabular-nums text-2xl font-bold text-zinc-100">{clientStats.projectsCount}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Proyectos</p>
        </div>
        {/* Tareas abiertas */}
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
          <ListTodo className="mb-2 h-4 w-4 text-cyan-400" strokeWidth={1.75} />
          <p className="tabular-nums text-2xl font-bold text-zinc-100">{clientStats.openTasks}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Tareas abiertas</p>
        </div>
        {/* Completadas */}
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
          <CheckCircle2 className="mb-2 h-4 w-4 text-cyan-400" strokeWidth={1.75} />
          <p className="tabular-nums text-2xl font-bold text-zinc-100">{clientStats.completed}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Completadas</p>
        </div>
        {/* Detenidas */}
        <div className={cn("rounded-xl border p-4 transition-colors", clientStats.stopped > 0 ? "border-red-500/20 bg-red-500/[0.04]" : "border-white/[0.06] bg-zinc-900/20")}>
          <PauseCircle className={cn("mb-2 h-4 w-4", clientStats.stopped > 0 ? "text-red-400" : "text-cyan-400")} strokeWidth={1.75} />
          <p className={cn("tabular-nums text-2xl font-bold", clientStats.stopped > 0 ? "text-red-300" : "text-zinc-100")}>{clientStats.stopped}</p>
          <p className={cn("mt-0.5 text-[11px]", clientStats.stopped > 0 ? "text-red-400/70" : "text-zinc-500")}>Detenidas</p>
        </div>
      </div>

      {/* ── SECCIÓN 3: PROYECTOS ACTIVOS ─────────────────────────────────── */}
      <div className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Proyectos activos</h3>
          <span className="text-xs text-zinc-500">{client.projects.length} proyecto{client.projects.length !== 1 ? "s" : ""}</span>
        </div>

        {client.projects.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 py-10 text-center">
            <p className="text-sm text-zinc-500">No hay proyectos</p>
            <button
              onClick={() => setModal({ type: "addProject" })}
              className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              + Crear primer proyecto
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
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

      {/* ── SECCIÓN 4: ACTIVIDAD RECIENTE ────────────────────────────────── */}
      {feed.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-3 text-sm font-semibold text-zinc-300">Actividad reciente</h3>
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 divide-y divide-white/[0.04]">
            {feed.map((event, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 flex-shrink-0">
                  {event.type === "client" && (
                    <CircleDot className="h-3.5 w-3.5 text-cyan-400" strokeWidth={2} />
                  )}
                  {event.type === "project" && (
                    <FolderKanban className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.75} />
                  )}
                  {event.type === "task" && (
                    <FileText className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.75} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-400">
                    <span className="text-zinc-500">
                      {event.type === "client" && "Cliente creado · "}
                      {event.type === "project" && "Proyecto creado · "}
                      {event.type === "task" && "Tarea creada · "}
                    </span>
                    <span className="font-medium text-zinc-300">{event.label}</span>
                    {event.context && (
                      <span className="ml-1 text-zinc-600">· {event.context}</span>
                    )}
                  </p>
                </div>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex-shrink-0 cursor-default text-[10px] text-zinc-600 tabular-nums">
                        {relativeTime(event.at)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="border-zinc-800 bg-zinc-900 text-zinc-300 text-xs">
                      {exactDate(event.at)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECCIÓN 5: NOTAS ─────────────────────────────────────────────── */}
      {client.notes && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Notas</p>
          <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">{client.notes}</p>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border-zinc-800 bg-[#0F0F12] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Se eliminará <span className="font-medium text-zinc-200">{client.name}</span> y todos
              sus proyectos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-red-700 text-white hover:bg-red-600"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
