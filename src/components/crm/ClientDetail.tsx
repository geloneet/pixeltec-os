"use client";

import type { CRMClient } from "@/types/crm";

const AVATAR_COLORS = ["#6d5acd", "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#06b6d4"];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

interface ClientDetailProps {
  client: CRMClient;
  setView: (v: "today" | "clients" | "client" | "project" | "search") => void;
  navigateToProject: (cid: string, pid: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
  deleteClient: (id: string) => void;
}

export function ClientDetail({ client, setView, navigateToProject, setModal, deleteClient }: ClientDetailProps) {
  const handleDelete = () => {
    if (confirm("¿Eliminar este cliente y todos sus proyectos?")) {
      deleteClient(client.id);
      setView("clients");
    }
  };

  return (
    <div>
      {/* Breadcrumb */}
      <button onClick={() => setView("clients")} className="text-[13px] text-zinc-500 hover:text-zinc-300 mb-4 block">
        ← Clientes
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
          style={{ backgroundColor: avatarColor(client.name) }}
        >
          {initials(client.name)}
        </span>
        <div className="flex-1">
          <h2 className="text-[20px] font-semibold text-zinc-200">{client.name}</h2>
          <p className="text-[12px] text-zinc-500">
            {[client.location, client.phone].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal({ type: "editClient", data: { id: client.id, name: client.name, phone: client.phone, location: client.location, notes: client.notes } })}
            className="rounded-lg bg-[#1c1c20] px-3 py-1.5 text-[12px] text-zinc-400 hover:text-zinc-200"
          >
            Editar
          </button>
          <button
            onClick={handleDelete}
            className="rounded-lg bg-[#1c1c20] px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
          >
            Eliminar
          </button>
        </div>
      </div>

      {/* Notes */}
      {client.notes && (
        <div className="bg-[#151518] border border-[#2a2a2f] rounded-[10px] p-4 mb-6">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">Notas</p>
          <p className="text-[13px] text-zinc-300 whitespace-pre-wrap">{client.notes}</p>
        </div>
      )}

      {/* Projects */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-medium text-zinc-400">Proyectos</h3>
        <button
          onClick={() => setModal({ type: "addProject" })}
          className="text-[12px] text-[#6d5acd] hover:text-[#8b7ae8]"
        >
          + Proyecto
        </button>
      </div>

      {client.projects.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-10">No hay proyectos</p>
      ) : (
        <div className="grid gap-3">
          {client.projects.map(p => {
            const total = p.tasks.length;
            const done = p.tasks.filter(t => t.status === "completado").length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <button
                key={p.id}
                onClick={() => navigateToProject(client.id, p.id)}
                className="bg-[#151518] border border-[#2a2a2f] rounded-[10px] p-4 text-left hover:border-[#3a3a3f] transition-colors w-full"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-medium text-zinc-200">{p.name}</p>
                  {p.domain && <span className="text-[11px] text-zinc-500">{p.domain}</span>}
                </div>
                {total > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[#1c1c20]">
                      <div className="h-full rounded-full bg-[#6d5acd]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-zinc-500">{pct}%</span>
                  </div>
                )}
                <p className="text-[11px] text-zinc-500 mt-2">
                  {total} tarea{total !== 1 ? "s" : ""} · {done} completada{done !== 1 ? "s" : ""}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
