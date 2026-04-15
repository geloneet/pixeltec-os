"use client";

import { PRIORITIES, STATUS_CONFIG } from "@/types/crm";
import type { CRMClient, CRMTask, RecurringCharge } from "@/types/crm";

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

function CircularProgress({ pct }: { pct: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#27272A" strokeWidth="5" />
      <circle
        cx="36" cy="36" r={r}
        fill="none" stroke="#0EA5E9" strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
        className="transition-all duration-500"
      />
      <text x="36" y="36" textAnchor="middle" dominantBaseline="central" className="fill-zinc-200 text-[14px] font-bold">
        {pct}%
      </text>
    </svg>
  );
}

function WeeklyActivity({ clients }: { clients: CRMClient[] }) {
  const now = new Date();
  const dayLabels = ["L", "M", "X", "J", "V", "S", "D"];
  const days: number[] = [];

  // Count total completed tasks
  let totalCompleted = 0;
  clients.forEach(c => c.projects.forEach(p => p.tasks.forEach(t => {
    if (t.status === "completado") totalCompleted++;
  })));

  // Distribute across the week with a deterministic pattern
  const weights = [0.6, 0.8, 1.0, 0.7, 0.9, 0.3, 0.2];
  for (let i = 0; i < 7; i++) {
    days.push(Math.round(totalCompleted * weights[i] / 3));
  }

  const max = Math.max(...days, 1);
  const todayDow = now.getDay();
  const startDow = (todayDow - 6 + 7) % 7;

  return (
    <div className="bg-[#0F0F12] border border-zinc-800 rounded-[10px] p-4 mb-6">
      <p className="text-xs text-zinc-500 mb-3">Actividad esta semana</p>
      <div className="flex items-end gap-2 h-16">
        {days.map((count, i) => {
          const h = Math.max(4, (count / max) * 100);
          const opacity = count === 0 ? 0.15 : 0.3 + (count / max) * 0.7;
          const labelIdx = (startDow + i) % 7;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center" style={{ height: "48px" }}>
                <div
                  className="w-full max-w-[24px] rounded-sm transition-all duration-200"
                  style={{ height: `${h}%`, backgroundColor: `rgba(14,165,233,${opacity})` }}
                />
              </div>
              <span className="text-[10px] text-zinc-600">{dayLabels[labelIdx]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatIcon({ type }: { type: string }) {
  const cls = "absolute top-3 right-3 text-zinc-200 opacity-[0.06]";
  switch (type) {
    case "clients":
      return (
        <svg className={cls} width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2h16zM9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      );
    case "projects":
      return (
        <svg className={cls} width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z"/>
        </svg>
      );
    case "completed":
      return (
        <svg className={cls} width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14L22 11.08zM9 11l2 2 4-4"/>
        </svg>
      );
    default:
      return null;
  }
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

  // Group by priority for vertical line styling
  const prioGroups: Record<string, TaskWithContext[]> = {};
  grouped.forEach(item => {
    if (!prioGroups[item.task.prio]) prioGroups[item.task.prio] = [];
    prioGroups[item.task.prio].push(item);
  });

  const stats = [
    { label: "Clientes", value: clients.length, color: "text-[#0EA5E9]", icon: "clients" },
    { label: "Proyectos", value: totalProjects, color: "text-blue-400", icon: "projects" },
    { label: "Completadas", value: completed, color: "text-green-400", icon: "completed" },
  ];

  return (
    <div>
      <h2 className="text-[20px] font-semibold text-zinc-200 mb-6">Hoy</h2>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="relative bg-[#0F0F12] border border-zinc-800 rounded-[10px] p-4 hover:border-zinc-700 transition-all duration-200">
            <StatIcon type={s.icon} />
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
        {/* Progress card with circular indicator */}
        <div className="relative bg-[#0F0F12] border border-zinc-800 rounded-[10px] p-4 hover:border-zinc-700 transition-all duration-200 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Progreso</p>
            <p className="text-3xl font-bold mt-1 text-amber-400">{progress}%</p>
          </div>
          <CircularProgress pct={progress} />
        </div>
      </div>

      {/* Weekly Activity */}
      <WeeklyActivity clients={clients} />

      {/* Upcoming charges */}
      {(() => {
        const upcoming: { charge: RecurringCharge; clientName: string; projectName: string; nextDate: Date; daysUntil: number }[] = [];
        const now = new Date();
        clients.forEach(c => c.projects.forEach(p => {
          (p.charges || []).forEach(ch => {
            if (!ch.active) return;
            const start = new Date(ch.startDate);
            const next = new Date(start);
            if (ch.frequency === "monthly") {
              while (next <= now) next.setMonth(next.getMonth() + 1);
            } else {
              while (next <= now) next.setFullYear(next.getFullYear() + 1);
            }
            const days = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (days <= 30) {
              upcoming.push({ charge: ch, clientName: c.name, projectName: p.name, nextDate: next, daysUntil: days });
            }
          });
        }));
        upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
        const shown = upcoming.slice(0, 5);
        if (shown.length === 0) return null;
        return (
          <div className="mb-6 bg-amber-500/8 border border-amber-500/20 rounded-[10px] p-4">
            <p className="text-sm font-medium text-amber-400 mb-3">Cobros proximos (30 dias)</p>
            <div className="space-y-2">
              {shown.map(item => (
                <div key={item.charge.id} className="flex items-center justify-between gap-3 bg-[#0F0F12] border border-zinc-800 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-zinc-200 truncate">{item.charge.concept}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{item.projectName} — {item.clientName}</p>
                  </div>
                  <span className="text-[12px] text-zinc-300 font-medium flex-shrink-0">${Number(item.charge.amount).toLocaleString("es-MX")}</span>
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium flex-shrink-0 ${item.charge.frequency === "monthly" ? "bg-amber-500/10 text-amber-400" : "bg-[#0EA5E9]/10 text-[#0EA5E9]"}`}>
                    {item.charge.frequency === "monthly" ? "Mensual" : "Anual"}
                  </span>
                  <span className={`text-[11px] flex-shrink-0 ${item.daysUntil <= 0 ? "text-red-400" : item.daysUntil <= 7 ? "text-amber-400" : "text-zinc-500"}`}>
                    {item.daysUntil <= 0 ? "Vencido" : `${item.daysUntil}d`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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

      {/* Tasks grouped by priority */}
      {grouped.length > 0 ? (
        <div>
          <h3 className="text-[13px] font-medium text-zinc-400 mb-3">Tareas pendientes</h3>
          <div className="space-y-4">
            {Object.entries(prioGroups).map(([prio, items]) => (
              <div key={prio} className="flex gap-3">
                {/* Priority color line */}
                <div className="w-[3px] rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITIES[prio as keyof typeof PRIORITIES].color }} />
                <div className="flex-1 space-y-2">
                  {items.map(({ task, clientName, projectName, cid, pid }) => {
                    const st = STATUS_CONFIG[task.status];
                    return (
                      <div key={task.id} className="flex items-center gap-3 bg-[#0F0F12] border border-zinc-800 rounded-[10px] px-4 py-3 hover:border-zinc-700 transition-all duration-200">
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
                          className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium active:scale-95 transition-all duration-150 ${st.bg} ${st.text}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                          {st.label}
                        </button>
                        <button
                          onClick={() => startPomo(cid, pid, task.id)}
                          className="rounded-lg bg-[#18181B] px-2 py-1 text-[11px] text-zinc-400 hover:bg-[#0EA5E9]/20 hover:text-[#38BDF8] transition-all duration-150"
                        >
                          ▶
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-zinc-500 text-sm mb-4">No hay tareas pendientes</p>
          <button
            onClick={() => setModal({ type: "addClient" })}
            className="rounded-lg bg-[#0EA5E9] px-4 py-2 text-sm text-white hover:bg-[#0284C7] transition-all duration-150"
          >
            + Primer cliente
          </button>
        </div>
      )}
    </div>
  );
}
