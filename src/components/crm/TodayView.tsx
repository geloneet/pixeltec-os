"use client";

import { PRIORITIES, STATUS_CONFIG } from "@/types/crm";
import type { CRMClient, CRMTask } from "@/types/crm";

interface TaskWithContext {
  task: CRMTask;
  clientName: string;
  projectName: string;
  cid: string;
  pid: string;
}

interface TodayViewProps {
  clients: CRMClient[];
  navigateToClient: (id: string) => void;
  navigateToProject: (cid: string, pid: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
  cycleTaskStatus: (cid: string, pid: string, tid: string) => void;
  startPomo: (cid: string, pid: string, tid: string) => void;
}

export function TodayView({ clients, navigateToClient, navigateToProject, setModal, cycleTaskStatus, startPomo }: TodayViewProps) {
  const totalProjects = clients.reduce((s, c) => s + c.projects.length, 0);
  const allTasks: TaskWithContext[] = [];
  let completed = 0;
  let total = 0;
  const stopped: TaskWithContext[] = [];

  clients.forEach(c => {
    c.projects.forEach(p => {
      p.tasks.forEach(t => {
        total++;
        if (t.status === "completado") completed++;
        const ctx: TaskWithContext = { task: t, clientName: c.name, projectName: p.name, cid: c.id, pid: p.id };
        allTasks.push(ctx);
        if (t.status === "detenido") stopped.push(ctx);
      });
    });
  });

  const pending = allTasks.filter(t => t.task.status !== "completado");
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const grouped = pending.sort((a, b) => PRIORITIES[a.task.prio].order - PRIORITIES[b.task.prio].order);

  const stats = [
    { label: "Clientes", value: clients.length, color: "text-[#6d5acd]" },
    { label: "Proyectos", value: totalProjects, color: "text-blue-400" },
    { label: "Completadas", value: completed, color: "text-green-400" },
    { label: "Progreso", value: `${progress}%`, color: "text-amber-400" },
  ];

  return (
    <div>
      <h2 className="text-[20px] font-semibold text-zinc-200 mb-6">Hoy</h2>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-[#151518] border border-[#2a2a2f] rounded-[10px] p-4">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Stopped alert */}
      {stopped.length > 0 && (
        <div className="mb-6 bg-red-500/8 border border-red-500/20 rounded-[10px] p-4">
          <p className="text-sm font-medium text-red-400">⚠ {stopped.length} tarea{stopped.length > 1 ? "s" : ""} detenida{stopped.length > 1 ? "s" : ""}</p>
          <div className="mt-2 space-y-1">
            {stopped.map(s => (
              <p key={s.task.id} className="text-[12px] text-red-300/70">
                {s.task.name} — {s.projectName} ({s.clientName})
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Tasks */}
      {grouped.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-[13px] font-medium text-zinc-400 mb-3">Tareas pendientes</h3>
          {grouped.map(({ task, clientName, projectName, cid, pid }) => {
            const st = STATUS_CONFIG[task.status];
            return (
              <div key={task.id} className="flex items-center gap-3 bg-[#151518] border border-[#2a2a2f] rounded-[10px] px-4 py-3">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITIES[task.prio].color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-zinc-200 truncate">{task.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    <span className="cursor-pointer hover:text-zinc-300" onClick={() => navigateToProject(cid, pid)}>{projectName}</span>
                    {" · "}
                    <span className="cursor-pointer hover:text-zinc-300" onClick={() => navigateToClient(cid)}>{clientName}</span>
                  </p>
                </div>
                <button
                  onClick={() => cycleTaskStatus(cid, pid, task.id)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${st.bg} ${st.text}`}
                >
                  {st.label}
                </button>
                <button
                  onClick={() => startPomo(cid, pid, task.id)}
                  className="rounded-lg bg-[#1c1c20] px-2 py-1 text-[11px] text-zinc-400 hover:bg-[#6d5acd]/20 hover:text-[#8b7ae8]"
                >
                  ▶
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-zinc-500 text-sm mb-4">No hay tareas pendientes</p>
          <button
            onClick={() => setModal({ type: "addClient" })}
            className="rounded-lg bg-[#6d5acd] px-4 py-2 text-sm text-white hover:bg-[#5a48b0]"
          >
            + Primer cliente
          </button>
        </div>
      )}
    </div>
  );
}
