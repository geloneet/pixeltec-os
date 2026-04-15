"use client";

import { useState, useRef, useCallback } from "react";
import { PRIORITIES, STATUS_CONFIG } from "@/types/crm";
import type { CRMClient, CRMProject, RecurringCharge } from "@/types/crm";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

interface ProjectViewProps {
  client: CRMClient;
  project: CRMProject;
  projectTab: string;
  setProjectTab: (t: string) => void;
  setView: (v: "today" | "clients" | "client" | "project" | "search") => void;
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

function getNextChargeDate(startDate: string, frequency: string): Date {
  const start = new Date(startDate);
  const now = new Date();
  const next = new Date(start);
  if (frequency === "monthly") {
    while (next <= now) next.setMonth(next.getMonth() + 1);
  } else {
    while (next <= now) next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

function formatDateES(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

const TABS = [
  { key: "tareas", label: "Tareas" },
  { key: "notas", label: "Notas" },
  { key: "info", label: "Info" },
  { key: "cobros", label: "Cobros" },
  { key: "llaves", label: "Llaves" },
  { key: "readme", label: "README" },
  { key: "prompt", label: "Prompt IA" },
];

export function ProjectView({
  client, project, projectTab, setProjectTab, setView, setModal,
  cycleTaskStatus, deleteTask, deleteKey, deleteProject, saveQuickNote,
  startPomo, pomoRunning, pomoTaskRef, pomoSeconds, pomoMode, pomoSessions,
  stopPomo, resetPomo, deleteCharge, updateCharge,
}: ProjectViewProps) {
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [noteValue, setNoteValue] = useState(project.quickNotes);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = project.tasks.length;
  const done = project.tasks.filter(t => t.status === "completado").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleDeleteProject = () => {
    if (confirm("¿Eliminar este proyecto y todas sus tareas?")) {
      deleteProject(client.id, project.id);
      setView("client");
    }
  };

  const handleNoteChange = useCallback((value: string) => {
    setNoteValue(value);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      saveQuickNote(client.id, project.id, value);
    }, 500);
  }, [client.id, project.id, saveQuickNote]);

  const sortedTasks = [...project.tasks].sort((a, b) => PRIORITIES[a.prio].order - PRIORITIES[b.prio].order);

  return (
    <div>
      {/* Breadcrumb */}
      <button onClick={() => setView("client")} className="text-[13px] text-zinc-500 hover:text-zinc-300 mb-4 block transition-colors duration-150">
        ← {client.name}
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[20px] font-semibold text-zinc-200">{project.name}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setModal({ type: "editProject", data: { id: project.id, name: project.name, domain: project.domain, budget: project.budget, annual: project.annual, tech: project.tech, accounts: project.accounts, guides: project.guides } })}
            className="rounded-lg bg-[#18181B] px-3 py-1.5 text-[12px] text-zinc-400 hover:text-zinc-200 transition-all duration-150"
          >
            Editar
          </button>
          <button
            onClick={handleDeleteProject}
            className="rounded-lg bg-[#18181B] px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
          >
            Eliminar
          </button>
        </div>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-2 rounded-full bg-[#18181B]">
            <div className="h-full rounded-full bg-[#0EA5E9] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[13px] text-zinc-400">{pct}%</span>
        </div>
      )}

      {/* Tabs - Linear style pill tabs */}
      <div className="flex gap-1 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setProjectTab(tab.key)}
            className={`px-4 py-2 text-[13px] rounded-md transition-colors duration-150 ${
              projectTab === tab.key
                ? "bg-zinc-800 text-[#0EA5E9]"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-[#18181B]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {projectTab === "tareas" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[12px] text-zinc-500">{total} tareas · {done} completadas</span>
            <button
              onClick={() => setModal({ type: "addTask" })}
              className="text-[12px] text-[#0EA5E9] hover:text-[#38BDF8] transition-colors duration-150"
            >
              + Tarea
            </button>
          </div>

          {/* Active pomodoro */}
          {pomoRunning && pomoTaskRef && pomoTaskRef.pid === project.id && (
            <div className="bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 rounded-[10px] p-4 mb-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-200 font-medium">
                    {project.tasks.find(t => t.id === pomoTaskRef.tid)?.name || "Pomodoro"}
                  </p>
                  <p className={`text-[11px] ${pomoMode === "work" ? "text-[#38BDF8]" : "text-green-400"}`}>
                    {pomoMode === "work" ? "Enfocado" : "Descanso"} · {pomoSessions} sesiones
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-bold text-zinc-200">{formatTime(pomoSeconds)}</span>
                  <button onClick={stopPomo} className="rounded-lg bg-[#18181B] px-2 py-1 text-[11px] text-zinc-400 hover:text-red-400 transition-all duration-150">⏹</button>
                  <button onClick={resetPomo} className="rounded-lg bg-[#18181B] px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-all duration-150">↺</button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {sortedTasks.map(task => {
              const st = STATUS_CONFIG[task.status];
              const isCompleted = task.status === "completado";
              return (
                <div key={task.id} className={`flex items-center gap-3 bg-[#0F0F12] border border-zinc-800 rounded-[10px] px-4 py-3 hover:border-zinc-700 transition-all duration-200 ${isCompleted ? "opacity-40" : ""}`}>
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITIES[task.prio].color }} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] text-zinc-200 ${isCompleted ? "line-through" : ""}`}>{task.name}</p>
                    {task.desc && <p className="text-[11px] text-zinc-500 truncate">{task.desc}</p>}
                  </div>
                  <button
                    onClick={() => cycleTaskStatus(client.id, project.id, task.id)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium active:scale-95 transition-all duration-150 ${st.bg} ${st.text}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                    {st.label}
                  </button>
                  <button
                    onClick={() => startPomo(client.id, project.id, task.id)}
                    className="rounded-lg bg-[#18181B] px-2 py-1 text-[11px] text-zinc-400 hover:bg-[#0EA5E9]/20 hover:text-[#38BDF8] transition-all duration-150"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => deleteTask(client.id, project.id, task.id)}
                    className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors duration-150"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {projectTab === "notas" && (
        <div className="relative">
          <textarea
            value={noteValue}
            onChange={e => handleNoteChange(e.target.value)}
            placeholder="Escribe notas rápidas aquí..."
            className="w-full h-80 bg-[#18181B] border border-zinc-800 rounded-lg px-4 py-3 text-[13px] text-zinc-200 focus:outline-none focus:border-[#0EA5E9] resize-none transition-colors duration-150"
          />
          <span className="absolute bottom-3 right-3 text-[10px] text-zinc-600">
            {(noteValue || "").length} caracteres
          </span>
        </div>
      )}

      {projectTab === "info" && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Dominio", value: project.domain },
            { label: "Presupuesto", value: project.budget },
            { label: "Costos anuales", value: project.annual },
            { label: "Tecnologías", value: project.tech },
            { label: "Cuentas", value: project.accounts },
            { label: "Guías", value: project.guides },
          ].map(item => (
            <div key={item.label} className="bg-[#0F0F12] border border-zinc-800 rounded-[10px] p-4 hover:border-zinc-700 transition-all duration-200">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">{item.label}</p>
              <p className="text-[13px] text-zinc-200 whitespace-pre-wrap">{item.value || "—"}</p>
            </div>
          ))}
        </div>
      )}

      {projectTab === "cobros" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[12px] text-zinc-500">{(project.charges || []).length} cobros recurrentes</span>
            <button
              onClick={() => setModal({ type: "addCharge", data: { clientEmail: client.email || "" } })}
              className="text-[12px] text-[#0EA5E9] hover:text-[#38BDF8] transition-colors duration-150"
            >
              + Cobro
            </button>
          </div>
          {(project.charges || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-zinc-500 text-sm mb-2">Sin cobros configurados</p>
              <p className="text-zinc-600 text-[12px]">Agrega un cobro recurrente para este proyecto.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(project.charges || []).map(charge => {
                const nextDate = getNextChargeDate(charge.startDate, charge.frequency);
                const daysUntil = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                let dateColor = "text-zinc-400";
                let dateLabel = `Próximo cobro: ${formatDateES(nextDate)}`;
                if (daysUntil <= 0) {
                  dateColor = "text-red-400";
                  dateLabel = `Vencido: ${formatDateES(nextDate)}`;
                } else if (daysUntil <= 30) {
                  dateColor = "text-amber-400";
                }
                return (
                  <div key={charge.id} className={`bg-[#0F0F12] border border-zinc-800 rounded-[10px] px-4 py-3 hover:border-zinc-700 transition-all duration-200 ${!charge.active ? "opacity-40" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-semibold text-zinc-200">{charge.concept}</span>
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${charge.frequency === "monthly" ? "bg-amber-500/10 text-amber-400" : "bg-[#0EA5E9]/10 text-[#0EA5E9]"}`}>
                            {charge.frequency === "monthly" ? "Mensual" : "Anual"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[12px]">
                          <span className="text-zinc-300 font-medium">${Number(charge.amount).toLocaleString("es-MX")} MXN</span>
                          <span className="text-zinc-600">Inicio: {formatDateES(new Date(charge.startDate))}</span>
                        </div>
                        <p className={`text-[11px] mt-1 ${dateColor}`}>{dateLabel}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => updateCharge(client.id, project.id, charge.id, { active: !charge.active })}
                          className={`rounded-lg px-2 py-1 text-[11px] transition-all duration-150 ${charge.active ? "bg-green-500/10 text-green-400" : "bg-zinc-800 text-zinc-500"}`}
                        >
                          {charge.active ? "Activo" : "Inactivo"}
                        </button>
                        <button
                          onClick={() => setModal({ type: "editCharge", data: { id: charge.id, concept: charge.concept, amount: charge.amount, frequency: charge.frequency, startDate: charge.startDate, clientEmail: charge.clientEmail } })}
                          className="rounded-lg bg-[#18181B] px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-all duration-150"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteCharge(client.id, project.id, charge.id)}
                          className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors duration-150"
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
      )}

      {projectTab === "llaves" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[12px] text-zinc-500">{project.keys.length} llaves</span>
            <button
              onClick={() => setModal({ type: "addKey" })}
              className="text-[12px] text-[#0EA5E9] hover:text-[#38BDF8] transition-colors duration-150"
            >
              + Llave
            </button>
          </div>
          <div className="space-y-2">
            {project.keys.map(k => (
              <div key={k.id} className="flex items-center gap-3 bg-[#0F0F12] border border-zinc-800 rounded-[10px] px-4 py-3 hover:border-zinc-700 transition-all duration-200">
                <span className="text-[13px] text-zinc-400 w-32 flex-shrink-0">{k.label}</span>
                <span
                  className={`flex-1 text-[13px] font-mono ${revealedKeys.has(k.id) ? "text-zinc-200" : "text-zinc-600 select-none"}`}
                  style={revealedKeys.has(k.id) ? {} : { filter: "blur(4px)" }}
                  onMouseEnter={() => setRevealedKeys(prev => new Set(prev).add(k.id))}
                  onMouseLeave={() => setRevealedKeys(prev => { const n = new Set(prev); n.delete(k.id); return n; })}
                >
                  {k.value}
                </span>
                <button
                  onClick={() => deleteKey(client.id, project.id, k.id)}
                  className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors duration-150"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {projectTab === "readme" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[12px] text-zinc-500">README</span>
            <button
              onClick={() => setModal({ type: "editReadme", data: { content: project.readme } })}
              className="text-[12px] text-[#0EA5E9] hover:text-[#38BDF8] transition-colors duration-150"
            >
              Editar
            </button>
          </div>
          <div className="bg-[#0F0F12] border border-zinc-800 rounded-[10px] p-4">
            <pre className="text-[13px] text-zinc-300 font-mono whitespace-pre-wrap">{project.readme || "Sin contenido"}</pre>
          </div>
        </div>
      )}

      {projectTab === "prompt" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[12px] text-zinc-500">Prompt para asistentes IA</span>
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(project.prompt)}
                className="rounded-lg bg-[#18181B] px-3 py-1.5 text-[12px] text-zinc-400 hover:text-zinc-200 transition-all duration-150"
              >
                Copiar
              </button>
              <button
                onClick={() => setModal({ type: "editPrompt", data: { content: project.prompt } })}
                className="text-[12px] text-[#0EA5E9] hover:text-[#38BDF8] transition-colors duration-150"
              >
                Editar
              </button>
            </div>
          </div>
          <div className="bg-[#0F0F12] border border-zinc-800 rounded-[10px] p-4">
            <pre className="text-[13px] text-zinc-300 font-mono whitespace-pre-wrap">{project.prompt || "Sin prompt configurado"}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
