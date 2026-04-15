"use client";

import { useState, useEffect, useCallback } from "react";

interface ServerInfo {
  diskTotal: string;
  diskUsed: string;
  diskFree: string;
  diskPercent: string;
  uptime: string;
  memTotal: string;
  memUsed: string;
  memFree: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  type: string;
  domain: string | null;
  description: string;
  status: string;
  size: string;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

function getStatusBadge(status: string): { label: string; bg: string; text: string } {
  const s = status.toLowerCase();
  if (s.startsWith("up") || s === "online") {
    return { label: "Online", bg: "bg-green-500/10", text: "text-green-400" };
  }
  if (s === "stopped") {
    return { label: "Detenido", bg: "bg-red-500/10", text: "text-red-400" };
  }
  if (s === "manual") {
    return { label: "Manual", bg: "bg-zinc-500/10", text: "text-zinc-400" };
  }
  return { label: "Desconocido", bg: "bg-amber-500/10", text: "text-amber-400" };
}

function TypeBadge({ type }: { type: string }) {
  if (type === "docker-compose" || type === "docker") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12.5c-.5-1-2-1.5-3.5-1.5H18c0-1.5-.5-3-2-3.5 0 0-.5 1.5-3 1.5S10 8 8.5 9c-1 .5-2 1.5-2.5 3H4.5C3 12 1.5 12.5 1 13.5"/>
          <rect x="4" y="6" width="3" height="3" rx=".5"/><rect x="8" y="6" width="3" height="3" rx=".5"/><rect x="12" y="6" width="3" height="3" rx=".5"/>
          <rect x="4" y="2" width="3" height="3" rx=".5"/><rect x="8" y="2" width="3" height="3" rx=".5"/>
        </svg>
        Docker
      </span>
    );
  }
  if (type === "pm2") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
        </svg>
        PM2
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-500/10 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
      Manual
    </span>
  );
}

function Spinner() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function SkeletonCard() {
  return (
    <div className="rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-5 animate-pulse">
      <div className="h-4 w-24 rounded bg-zinc-800 mb-3" />
      <div className="h-6 w-16 rounded bg-zinc-800" />
    </div>
  );
}

function SkeletonProject() {
  return (
    <div className="rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 rounded-lg bg-zinc-800" />
        <div className="h-4 w-32 rounded bg-zinc-800" />
      </div>
      <div className="h-3 w-48 rounded bg-zinc-800 mb-2" />
      <div className="h-3 w-24 rounded bg-zinc-800" />
    </div>
  );
}

export function ServerView() {
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, "deploy" | "restart" | null>>({});
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/vps/status");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setServer(data.server);
      setProjects(data.projects);
    } catch {
      showToast("Error al obtener estado del servidor", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleRefresh = () => {
    setLoading(true);
    fetchStatus();
  };

  const handleAction = async (projectId: string, action: "deploy" | "restart") => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    if (action === "deploy" && projectId === "pixeltec-os") {
      if (!window.confirm("Este deploy reinicia el CRM. La pagina se recargara. Continuar?")) return;
    }

    setActionLoading(prev => ({ ...prev, [projectId]: action }));

    try {
      const res = await fetch(`/api/vps/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`${project.name}: ${action === "deploy" ? "Deploy" : "Restart"} exitoso`, "success");
        if (projectId === "pixeltec-os" && action === "deploy") {
          setTimeout(() => window.location.reload(), 10000);
        }
        fetchStatus();
      } else {
        showToast(`${project.name}: ${data.error || "Error"}`, "error");
      }
    } catch {
      showToast(`${project.name}: Error de conexion`, "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [projectId]: null }));
    }
  };

  const activeCount = projects.filter(p => {
    const s = p.status.toLowerCase();
    return s.startsWith("up") || s === "online";
  }).length;

  const diskPct = server?.diskPercent ? parseInt(server.diskPercent) : 0;

  return (
    <div className="max-w-[900px]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 ${
          toast.type === "success"
            ? "bg-green-500/15 text-green-400 border border-green-500/20"
            : "bg-red-500/15 text-red-400 border border-red-500/20"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Servidor</h2>
          <p className="text-[13px] text-zinc-500 mt-0.5">Estado del VPS y proyectos desplegados</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#0F0F12] px-3 py-2 text-[13px] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors duration-150 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* Server stats */}
      {loading ? (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : server && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {/* Disco */}
          <div className="rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Disco</span>
            </div>
            <div className="text-lg font-bold text-white">{server.diskUsed}<span className="text-[13px] text-zinc-500 font-normal"> / {server.diskTotal}</span></div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${diskPct > 90 ? "bg-red-500" : diskPct > 70 ? "bg-amber-500" : "bg-[#0EA5E9]"}`}
                style={{ width: `${Math.min(diskPct, 100)}%` }}
              />
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">{server.diskPercent} usado</div>
          </div>

          {/* RAM */}
          <div className="rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01"/>
              </svg>
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider">RAM</span>
            </div>
            <div className="text-lg font-bold text-white">{server.memUsed}<span className="text-[13px] text-zinc-500 font-normal"> / {server.memTotal}</span></div>
          </div>

          {/* Uptime */}
          <div className="rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Uptime</span>
            </div>
            <div className="text-lg font-bold text-white">{server.uptime.replace("up ", "")}</div>
          </div>

          {/* Proyectos */}
          <div className="rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Proyectos</span>
            </div>
            <div className="text-lg font-bold text-white">{activeCount}<span className="text-[13px] text-zinc-500 font-normal"> / {projects.length} activos</span></div>
          </div>
        </div>
      )}

      {/* Projects */}
      <div className="space-y-3">
        {loading ? (
          <>
            <SkeletonProject /><SkeletonProject /><SkeletonProject />
          </>
        ) : (
          projects.map(project => {
            const badge = getStatusBadge(project.status);
            const isActioning = actionLoading[project.id];
            const isManual = project.type === "manual";

            return (
              <div
                key={project.id}
                className="rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-5 hover:border-zinc-700 transition-all duration-150"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[15px] font-semibold text-white">{project.name}</span>
                      <TypeBadge type={project.type} />
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-[13px] text-zinc-500 mb-2">{project.description}</p>
                    <div className="flex items-center gap-4 text-[12px] text-zinc-600">
                      <span className="font-mono text-[11px]">{project.path}</span>
                      <span>{project.size}</span>
                      {project.domain && (
                        <a
                          href={`https://${project.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0EA5E9] hover:text-[#38BDF8] transition-colors"
                        >
                          {project.domain}
                        </a>
                      )}
                    </div>
                  </div>

                  {!isManual && (
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <button
                        onClick={() => handleAction(project.id, "restart")}
                        disabled={!!isActioning}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all duration-150 disabled:opacity-50"
                      >
                        {isActioning === "restart" ? <Spinner /> : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                          </svg>
                        )}
                        Restart
                      </button>
                      <button
                        onClick={() => handleAction(project.id, "deploy")}
                        disabled={!!isActioning}
                        className="flex items-center gap-1.5 rounded-lg bg-[#0EA5E9] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0284C7] transition-all duration-150 disabled:opacity-50"
                      >
                        {isActioning === "deploy" ? (
                          <>
                            <Spinner />
                            Desplegando...
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9z"/>
                            </svg>
                            Deploy
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
