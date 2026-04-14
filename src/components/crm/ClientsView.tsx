"use client";

import type { CRMClient } from "@/types/crm";

const AVATAR_COLORS = ["#0EA5E9", "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#06b6d4"];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

interface ClientsViewProps {
  clients: CRMClient[];
  navigateToClient: (id: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
}

export function ClientsView({ clients, navigateToClient, setModal }: ClientsViewProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[20px] font-semibold text-zinc-200">Clientes</h2>
        <button
          onClick={() => setModal({ type: "addClient" })}
          className="rounded-lg bg-[#0EA5E9] px-4 py-2 text-sm text-white hover:bg-[#0284C7] transition-all duration-150"
        >
          + Cliente
        </button>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-20">No hay clientes aún</p>
      ) : (
        <div className="grid gap-3">
          {clients.map(c => {
            const totalTasks = c.projects.reduce((s, p) => s + p.tasks.length, 0);
            const completedTasks = c.projects.reduce((s, p) => s + p.tasks.filter(t => t.status === "completado").length, 0);
            const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const color = avatarColor(c.name);

            return (
              <button
                key={c.id}
                onClick={() => navigateToClient(c.id)}
                className="flex items-center gap-4 bg-[#0F0F12] border border-zinc-800 rounded-[10px] p-4 text-left hover:border-zinc-700 hover:-translate-y-0.5 transition-all duration-200 w-full"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white flex-shrink-0 ring-1"
                  style={{ backgroundColor: color, boxShadow: `0 0 0 1px ${color}30` }}
                >
                  {initials(c.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-zinc-200">{c.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {c.location && <span>{c.location} · </span>}
                    {c.phone && <span>{c.phone}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-zinc-500 flex-shrink-0">
                  <span>{c.projects.length} proyecto{c.projects.length !== 1 ? "s" : ""}</span>
                  <span>{totalTasks} tarea{totalTasks !== 1 ? "s" : ""}</span>
                  {totalTasks > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="h-[3px] w-16 rounded-full bg-[#18181B]">
                        <div className="h-full rounded-full bg-[#0EA5E9]" style={{ width: `${pct}%` }} />
                      </div>
                      <span>{pct}%</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
