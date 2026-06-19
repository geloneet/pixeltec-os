"use client";

import { useState, useRef, useCallback, useMemo } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ListTodo,
  CheckCircle2,
  PauseCircle,
  TrendingUp,
  ArrowLeft,
  CircleDot,
  FileText,
  FolderKanban,
  AlignLeft,
  LayoutGrid,
} from "lucide-react";
import { PRIORITIES, STATUS_CONFIG } from "@/types/crm";
import type { CRMClient, CRMProject, CRMTask, RecurringCharge } from "@/types/crm";
import {
  deriveProjectStats,
  projectStatus,
  buildProjectActivityFeed,
} from "@/lib/crm/client-stats";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn, formatCurrency } from "@/lib/utils";
import { getNextChargeDate } from "@/lib/crm/next-charge-date";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function formatDateES(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
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

// ── KanbanCard ────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  task: CRMTask;
  clientId: string;
  projectId: string;
  cycleTaskStatus: (cid: string, pid: string, tid: string) => void;
  startPomo: (cid: string, pid: string, tid: string) => void;
  deleteTask: (cid: string, pid: string, tid: string) => void;
}

function KanbanCard({ task, clientId, projectId, cycleTaskStatus, startPomo, deleteTask }: KanbanCardProps) {
  const st = STATUS_CONFIG[task.status];
  const isCompleted = task.status === "completado";

  return (
    <div className={cn("rounded-lg border border-white/[0.06] bg-zinc-900/30 p-3 space-y-2 transition-colors hover:border-white/[0.10]", isCompleted && "opacity-40")}>
      <div className="flex items-start gap-2">
        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: PRIORITIES[task.prio].color }} />
        <p className={cn("flex-1 text-xs font-medium text-zinc-200 leading-snug", isCompleted && "line-through")}>{task.name}</p>
      </div>
      {task.desc && <p className="truncate pl-3.5 text-[10px] text-zinc-500">{task.desc}</p>}
      <div className="flex items-center justify-between pl-3.5">
        <button
          onClick={() => cycleTaskStatus(clientId, projectId, task.id)}
          className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium active:scale-95 transition-all", st.bg, st.text)}
        >
          {st.label}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => startPomo(clientId, projectId, task.id)}
            className="rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-cyan-500/10 hover:text-cyan-400"
          >
            ▶
          </button>
          <button
            onClick={() => deleteTask(clientId, projectId, task.id)}
            className="rounded px-1.5 py-0.5 text-[10px] text-zinc-600 transition-colors hover:text-red-400"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Props & Tabs ──────────────────────────────────────────────────────────────

interface ProjectViewProps {
  client: CRMClient;
  project: CRMProject;
  projectTab: string;
  setProjectTab: (t: string) => void;
  setView: (v: "asistente" | "clients" | "client" | "project" | "search") => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
  cycleTaskStatus: (cid: string, pid: string, tid: string) => void;
  deleteTask: (cid: string, pid: string, tid: string) => void;
  deleteKey: (cid: string, pid: string, kid: string) => void;
  deleteProject: (cid: string, pid: string) => void;
  saveQuickNote: (cid: string, pid: string, note: string) => void;
  startPomo: (cid: string, pid: string, tid: string) => void;
  pomoRunning: boolean;
  pomoTaskRef: { cid: string; pid: string; tid: string } | null;
  pomoSeconds: number;
  pomoMode: "work" | "break";
  pomoSessions: number;
  stopPomo: () => void;
  resetPomo: () => void;
  deleteCharge: (cid: string, pid: string, chargeId: string) => void;
  updateCharge: (cid: string, pid: string, chargeId: string, data: Partial<RecurringCharge>) => void;
}

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "tareas", label: "Tareas" },
  { key: "recursos", label: "Recursos" },
  { key: "finanzas", label: "Finanzas" },
];

// ── ProjectView ───────────────────────────────────────────────────────────────

export function ProjectView({
  client, project, projectTab, setProjectTab, setView, setModal,
  cycleTaskStatus, deleteTask, deleteKey, deleteProject, saveQuickNote,
  startPomo, pomoRunning, pomoTaskRef, pomoSeconds, pomoMode, pomoSessions,
  stopPomo, resetPomo, deleteCharge, updateCharge,
}: ProjectViewProps) {
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [noteValue, setNoteValue] = useState(project.quickNotes);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [taskView, setTaskView] = useState<"lista" | "kanban">("lista");
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived data
  const projectStats = useMemo(() => deriveProjectStats(project), [project]);
  const badge = useMemo(() => projectStatus(projectStats), [projectStats]);
  const feed = useMemo(() => buildProjectActivityFeed(project, 6), [project]);
  const sortedTasks = useMemo(
    () => [...project.tasks].sort((a, b) => PRIORITIES[a.prio].order - PRIORITIES[b.prio].order),
    [project]
  );
  const nextTask = useMemo(
    () => sortedTasks.find(t => t.status === "pendiente" || t.status === "proceso") ?? null,
    [sortedTasks]
  );
  const kanbanColumns = useMemo(() => [
    { key: "pendiente", label: "Pendiente", hd: "text-purple-400", tasks: sortedTasks.filter(t => t.status === "pendiente") },
    { key: "proceso",   label: "En proceso", hd: "text-amber-400",  tasks: sortedTasks.filter(t => t.status === "proceso") },
    { key: "detenido",  label: "Detenido",   hd: "text-red-400",    tasks: sortedTasks.filter(t => t.status === "detenido") },
    { key: "completado",label: "Completado", hd: "text-green-400",  tasks: sortedTasks.filter(t => t.status === "completado") },
  ], [sortedTasks]);

  const isPomoActive = pomoRunning && pomoTaskRef?.pid === project.id;

  const handleDeleteConfirmed = () => {
    deleteProject(client.id, project.id);
    setView("client");
  };

  const handleNoteChange = useCallback((value: string) => {
    setNoteValue(value);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      saveQuickNote(client.id, project.id, value);
    }, 500);
  }, [client.id, project.id, saveQuickNote]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">

      {/* Delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border-zinc-800 bg-[#0F0F12] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar proyecto?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Se eliminará <span className="font-medium text-zinc-200">{project.name}</span> y todas
              sus tareas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirmed} className="bg-red-700 text-white hover:bg-red-600">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <button
        onClick={() => setView("client")}
        className="mb-5 flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {client.name}
      </button>

      {/* ── Persistent header ─────────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-100">{project.name}</h2>
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.colorClass)}>
              {badge.label}
            </span>
          </div>
          {(project.domain || client.name) && (
            <p className="mt-0.5 text-sm text-zinc-500">
              {[project.domain, client.name].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => setModal({
              type: "editProject",
              data: { id: project.id, name: project.name, domain: project.domain, budget: project.budget.toString(), annual: project.annual.toString(), budgetIva: project.budgetIva, annualIva: project.annualIva, tech: project.tech, accounts: project.accounts, guides: project.guides },
            })}
            className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:border-white/[0.10] hover:text-zinc-200"
          >
            Editar
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:border-red-500/20 hover:bg-red-500/[0.04] hover:text-red-400"
          >
            Eliminar
          </button>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex gap-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setProjectTab(tab.key)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150",
              projectTab === tab.key
                ? "bg-zinc-800 text-cyan-400"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════ RESUMEN ══════════════════════════════════════════ */}
      {projectTab === "resumen" && (
        <div>
          {/* KPIs */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
              <ListTodo className="mb-2 h-4 w-4 text-cyan-400" strokeWidth={1.75} />
              <p className="tabular-nums text-2xl font-bold text-zinc-100">{projectStats.openTasks}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Tareas abiertas</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
              <CheckCircle2 className="mb-2 h-4 w-4 text-cyan-400" strokeWidth={1.75} />
              <p className="tabular-nums text-2xl font-bold text-zinc-100">{projectStats.completed}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Completadas</p>
            </div>
            <div className={cn("rounded-xl border p-4 transition-colors", projectStats.stopped > 0 ? "border-red-500/20 bg-red-500/[0.04]" : "border-white/[0.06] bg-zinc-900/20")}>
              <PauseCircle className={cn("mb-2 h-4 w-4", projectStats.stopped > 0 ? "text-red-400" : "text-cyan-400")} strokeWidth={1.75} />
              <p className={cn("tabular-nums text-2xl font-bold", projectStats.stopped > 0 ? "text-red-300" : "text-zinc-100")}>{projectStats.stopped}</p>
              <p className={cn("mt-0.5 text-[11px]", projectStats.stopped > 0 ? "text-red-400/70" : "text-zinc-500")}>Detenidas</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
              <TrendingUp className="mb-2 h-4 w-4 text-cyan-400" strokeWidth={1.75} />
              <p className="tabular-nums text-2xl font-bold text-zinc-100">{projectStats.pct}%</p>
              <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={cn("h-full rounded-full", projectStats.pct >= 100 ? "bg-green-500" : "bg-cyan-500")}
                  style={{ width: `${projectStats.pct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">Progreso</p>
            </div>
          </div>

          {/* Siguiente acción */}
          <div className="mb-5">
            <h3 className="mb-2 text-sm font-semibold text-zinc-300">Siguiente acción</h3>
            {nextTask ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setProjectTab("tareas")}
                onKeyDown={(e) => { if (e.key === "Enter") setProjectTab("tareas"); }}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4 transition-colors hover:bg-cyan-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
              >
                <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: PRIORITIES[nextTask.prio].color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-zinc-100">{nextTask.name}</p>
                  {nextTask.desc && <p className="mt-0.5 truncate text-xs text-zinc-500">{nextTask.desc}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-medium" style={{ color: PRIORITIES[nextTask.prio].color }}>
                      {PRIORITIES[nextTask.prio].label}
                    </span>
                    <span className="text-zinc-700">·</span>
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_CONFIG[nextTask.status].bg, STATUS_CONFIG[nextTask.status].text)}>
                      {STATUS_CONFIG[nextTask.status].label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); startPomo(client.id, project.id, nextTask.id); }}
                  className="flex-shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
                >
                  ▶ Pomo
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-5 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-green-400" />
                <p className="text-sm font-medium text-zinc-300">Todo al día</p>
                <p className="text-xs text-zinc-500">No hay tareas pendientes ni en proceso</p>
              </div>
            )}
          </div>

          {/* Actividad reciente */}
          {feed.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-2 text-sm font-semibold text-zinc-300">Actividad reciente</h3>
              <div className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06] bg-zinc-900/20">
                {feed.map((event, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {event.type === "project" && <FolderKanban className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.75} />}
                      {event.type === "task"    && <FileText className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.75} />}
                      {event.type === "client"  && <CircleDot className="h-3.5 w-3.5 text-cyan-400" strokeWidth={2} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs">
                        <span className="text-zinc-500">
                          {event.type === "project" && "Proyecto creado · "}
                          {event.type === "task"    && "Tarea creada · "}
                          {event.type === "client"  && "Cliente creado · "}
                        </span>
                        <span className="font-medium text-zinc-300">{event.label}</span>
                      </p>
                    </div>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-shrink-0 cursor-default tabular-nums text-[10px] text-zinc-600">
                            {relativeTime(event.at)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="border-zinc-800 bg-zinc-900 text-xs text-zinc-300">
                          {exactDate(event.at)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notas del proyecto */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-zinc-300">Notas del proyecto</h3>
            <div className="relative">
              <textarea
                value={noteValue}
                onChange={e => handleNoteChange(e.target.value)}
                placeholder="Notas rápidas, ideas, recordatorios..."
                className="w-full resize-none rounded-xl border border-white/[0.06] bg-zinc-900/20 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none transition-colors"
                rows={5}
              />
              <span className="absolute bottom-3 right-3 text-[10px] text-zinc-600">
                {(noteValue || "").length} ch
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-600">No guardes tokens ni contraseñas aquí — usa <span className="text-zinc-500">Recursos</span>.</p>
          </div>
        </div>
      )}

      {/* ══════════════════ TAREAS ═══════════════════════════════════════════ */}
      {projectTab === "tareas" && (
        <div>
          {/* Pomodoro banner */}
          {isPomoActive && (
            <div className="mb-4 animate-pulse rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {project.tasks.find(t => t.id === pomoTaskRef!.tid)?.name || "Pomodoro"}
                  </p>
                  <p className={cn("text-[11px]", pomoMode === "work" ? "text-cyan-400" : "text-green-400")}>
                    {pomoMode === "work" ? "Enfocado" : "Descanso"} · {pomoSessions} sesiones
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-bold text-zinc-200">{formatTime(pomoSeconds)}</span>
                  <button onClick={stopPomo} className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2 py-1 text-[11px] text-zinc-400 hover:text-red-400 transition-all">⏹</button>
                  <button onClick={resetPomo} className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-all">↺</button>
                </div>
              </div>
            </div>
          )}

          {/* Actions bar */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">{project.tasks.length} tareas</span>
              <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] p-0.5">
                <button
                  onClick={() => setTaskView("lista")}
                  className={cn("flex h-6 w-6 items-center justify-center rounded-md transition-all", taskView === "lista" ? "bg-zinc-800 text-cyan-400" : "text-zinc-500 hover:text-zinc-300")}
                  aria-label="Vista lista"
                >
                  <AlignLeft className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setTaskView("kanban")}
                  className={cn("flex h-6 w-6 items-center justify-center rounded-md transition-all", taskView === "kanban" ? "bg-zinc-800 text-cyan-400" : "text-zinc-500 hover:text-zinc-300")}
                  aria-label="Vista kanban"
                >
                  <LayoutGrid className="h-3 w-3" />
                </button>
              </div>
            </div>
            <button
              onClick={() => setModal({ type: "addTask", data: { clientName: client.name, projectName: project.name } })}
              className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
            >
              + Tarea
            </button>
          </div>

          {/* Lista view */}
          {taskView === "lista" && (
            <div className="space-y-1.5">
              {sortedTasks.length === 0 && (
                <p className="py-10 text-center text-sm text-zinc-500">No hay tareas</p>
              )}
              {sortedTasks.map(task => {
                const st = STATUS_CONFIG[task.status];
                const isCompleted = task.status === "completado";
                return (
                  <div
                    key={task.id}
                    className={cn("flex items-center gap-3 rounded-xl border border-white/[0.06] bg-zinc-900/20 px-4 py-3 transition-all hover:border-white/[0.10]", isCompleted && "opacity-40")}
                  >
                    <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: PRIORITIES[task.prio].color }} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm text-zinc-200", isCompleted && "line-through")}>{task.name}</p>
                      {task.desc && <p className="truncate text-[11px] text-zinc-500">{task.desc}</p>}
                    </div>
                    <button
                      onClick={() => cycleTaskStatus(client.id, project.id, task.id)}
                      className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium active:scale-95 transition-all", st.bg, st.text)}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {st.label}
                    </button>
                    <button
                      onClick={() => startPomo(client.id, project.id, task.id)}
                      className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2 py-1 text-[11px] text-zinc-400 transition-all hover:border-cyan-500/20 hover:bg-cyan-500/10 hover:text-cyan-400"
                    >
                      ▶
                    </button>
                    <button
                      onClick={() => deleteTask(client.id, project.id, task.id)}
                      className="text-[11px] text-zinc-600 transition-colors hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Kanban view */}
          {taskView === "kanban" && (
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[640px] grid-cols-4 gap-3">
                {kanbanColumns.map(col => (
                  <div key={col.key} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-zinc-900/30 px-3 py-2">
                      <span className={cn("text-xs font-semibold", col.hd)}>{col.label}</span>
                      <span className="tabular-nums text-[10px] text-zinc-600">{col.tasks.length}</span>
                    </div>
                    <div className="space-y-2">
                      {col.tasks.map(task => (
                        <KanbanCard
                          key={task.id}
                          task={task}
                          clientId={client.id}
                          projectId={project.id}
                          cycleTaskStatus={cycleTaskStatus}
                          startPomo={startPomo}
                          deleteTask={deleteTask}
                        />
                      ))}
                      {col.tasks.length === 0 && (
                        <div className="rounded-lg border border-dashed border-white/[0.06] p-3 text-center">
                          <p className="text-[10px] text-zinc-700">Sin tareas</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ RECURSOS ═════════════════════════════════════════ */}
      {projectTab === "recursos" && (
        <div className="space-y-6">
          {/* Credenciales */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">Credenciales</h3>
              <button
                onClick={() => setModal({ type: "addKey" })}
                className="text-xs text-cyan-400 transition-colors hover:text-cyan-300"
              >
                + Llave
              </button>
            </div>
            {project.keys.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 text-center">
                <p className="text-sm text-zinc-500">Sin credenciales</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04] overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/20">
                {project.keys.map(k => (
                  <div key={k.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-32 flex-shrink-0 text-xs text-zinc-400">{k.label}</span>
                    <span
                      className={cn("flex-1 font-mono text-xs", revealedKeys.has(k.id) ? "text-zinc-200" : "select-none text-zinc-600")}
                      style={revealedKeys.has(k.id) ? {} : { filter: "blur(4px)" }}
                      onMouseEnter={() => setRevealedKeys(prev => new Set(prev).add(k.id))}
                      onMouseLeave={() => setRevealedKeys(prev => { const n = new Set(prev); n.delete(k.id); return n; })}
                    >
                      {k.value}
                    </span>
                    <button
                      onClick={() => deleteKey(client.id, project.id, k.id)}
                      className="text-[11px] text-zinc-600 transition-colors hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documentación */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">Documentación</h3>
              <button
                onClick={() => setModal({ type: "editReadme", data: { content: project.readme } })}
                className="text-xs text-cyan-400 transition-colors hover:text-cyan-300"
              >
                Editar
              </button>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
              {project.readme ? (
                <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-300">{project.readme}</pre>
              ) : (
                <p className="text-sm italic text-zinc-600">Sin contenido. Edita para agregar documentación.</p>
              )}
            </div>
          </div>

          {/* Prompt IA */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">Prompt IA</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(project.prompt)}
                  className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2.5 py-1 text-xs text-zinc-400 transition-all hover:text-zinc-200"
                >
                  Copiar
                </button>
                <button
                  onClick={() => setModal({ type: "editPrompt", data: { content: project.prompt } })}
                  className="text-xs text-cyan-400 transition-colors hover:text-cyan-300"
                >
                  Editar
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
              {project.prompt ? (
                <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-300">{project.prompt}</pre>
              ) : (
                <p className="text-sm italic text-zinc-600">Sin prompt configurado. Edita para agregar contexto IA.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ FINANZAS ═════════════════════════════════════════ */}
      {projectTab === "finanzas" && (
        <div className="space-y-6">
          {/* Info económica */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">Info económica</h3>
              <button
                onClick={() => setModal({
                  type: "editProject",
                  data: { id: project.id, name: project.name, domain: project.domain, budget: project.budget.toString(), annual: project.annual.toString(), budgetIva: project.budgetIva, annualIva: project.annualIva, tech: project.tech, accounts: project.accounts, guides: project.guides },
                })}
                className="text-xs text-cyan-400 transition-colors hover:text-cyan-300"
              >
                Editar
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Presupuesto</p>
                <p className="text-sm text-zinc-200">{project.budget ? `${formatCurrency(project.budget)}${project.budgetIva === "plus" ? " + IVA" : project.budgetIva === "included" ? " IVA incl." : ""}` : "—"}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Costos anuales</p>
                <p className="text-sm text-zinc-200">{project.annual ? `${formatCurrency(project.annual)}${project.annualIva === "plus" ? " + IVA" : project.annualIva === "included" ? " IVA incl." : ""}` : "—"}</p>
              </div>
            </div>
          </div>

          {/* Cobros recurrentes */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">Cobros recurrentes</h3>
              <button
                onClick={() => setModal({ type: "addCharge", data: { clientEmail: client.email || "" } })}
                className="text-xs text-cyan-400 transition-colors hover:text-cyan-300"
              >
                + Cobro
              </button>
            </div>
            {(project.charges || []).length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 py-10 text-center">
                <p className="text-sm text-zinc-500">Sin cobros configurados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(project.charges || []).map(charge => {
                  const nextDate = getNextChargeDate(charge.startDate, charge.frequency);
                  const daysUntil = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  let dateColor = "text-zinc-400";
                  let dateLabel = `Próximo cobro: ${formatDateES(nextDate)}`;
                  if (daysUntil <= 0) { dateColor = "text-red-400"; dateLabel = `Vencido: ${formatDateES(nextDate)}`; }
                  else if (daysUntil <= 30) { dateColor = "text-amber-400"; }
                  return (
                    <div
                      key={charge.id}
                      className={cn("rounded-xl border border-white/[0.06] bg-zinc-900/20 px-4 py-3 transition-all hover:border-white/[0.10]", !charge.active && "opacity-40")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-200">{charge.concept}</span>
                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", charge.frequency === "monthly" ? "bg-amber-500/10 text-amber-400" : "bg-cyan-500/10 text-cyan-400")}>
                              {charge.frequency === "monthly" ? "Mensual" : "Anual"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="font-medium text-zinc-300">${Number(charge.amount).toLocaleString("es-MX")} MXN</span>
                            <span className="text-zinc-600">Inicio: {formatDateES(new Date(charge.startDate))}</span>
                          </div>
                          <p className={cn("mt-1 text-[11px]", dateColor)}>{dateLabel}</p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => updateCharge(client.id, project.id, charge.id, { active: !charge.active })}
                            className={cn("rounded-lg px-2 py-1 text-[11px] transition-all", charge.active ? "bg-green-500/10 text-green-400" : "border border-white/[0.06] bg-zinc-900/40 text-zinc-500")}
                          >
                            {charge.active ? "Activo" : "Inactivo"}
                          </button>
                          <button
                            onClick={() => setModal({ type: "editCharge", data: { id: charge.id, concept: charge.concept, amount: charge.amount, frequency: charge.frequency, startDate: charge.startDate, clientEmail: charge.clientEmail } })}
                            className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2 py-1 text-[11px] text-zinc-400 transition-all hover:text-zinc-200"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deleteCharge(client.id, project.id, charge.id)}
                            className="text-[11px] text-zinc-600 transition-colors hover:text-red-400"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
