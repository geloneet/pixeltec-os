"use client";
import type { CRMProject, CRMTask } from "@/types/crm";

interface Props {
  project: CRMProject | null;
}

const TASK_STATUS = {
  pendiente:    { label: "Pendiente",   classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
  en_progreso:  { label: "En progreso", classes: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
  en_revision:  { label: "En revisión", classes: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20" },
  completado:   { label: "Completado",  classes: "bg-green-500/15 text-green-300 border-green-500/20" },
  pausado:      { label: "Pausada",     classes: "bg-zinc-700/40 text-zinc-400 border-zinc-600/20" },
  bloqueado:    { label: "Bloqueada",   classes: "bg-red-500/15 text-red-400 border-red-500/20" },
} satisfies Record<CRMTask["status"], { label: string; classes: string }>;

export default function PortalProyecto({ project }: Props) {
  if (!project) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
        <p className="text-zinc-500 text-sm">No hay proyecto activo</p>
      </div>
    );
  }

  const tasks = project.tasks ?? [];

  // Sort log entries by createdAt desc, take top 10
  const logEntries = [...(project.notesLog ?? [])]
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Tasks section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Tareas del proyecto
        </h2>

        {tasks.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin tareas registradas</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {tasks.map(task => {
              const statusCfg = TASK_STATUS[task.status];
              return (
                <li key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span
                    className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusCfg.classes}`}
                  >
                    {statusCfg.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 font-medium leading-snug">
                      {task.name}
                    </p>
                    {task.desc && (
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                        {task.desc}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Log / Bitácora section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Bitácora
        </h2>

        {logEntries.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin entradas en la bitácora</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {logEntries.map(entry => (
              <li key={entry.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                    {entry.category}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {new Date(entry.createdAt).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {entry.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
