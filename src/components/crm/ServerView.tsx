"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCRM } from "./CRMContext";

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
  active: boolean;
  pm2Name: string | null;
  containerName: string | null;
}

interface HealthResult {
  id: string;
  name: string;
  domain: string;
  statusCode: number | null;
  ok: boolean;
  error: string | null;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

function getStatusBadge(status: string, active: boolean): { label: string; bg: string; text: string } {
  if (!active || status === "paused") {
    return { label: "Pausado", bg: "bg-zinc-500/10", text: "text-zinc-400" };
  }
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
  const [actionLoading, setActionLoading] = useState<Record<string, string | null>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [logsModal, setLogsModal] = useState<{ open: boolean; projectId: string; projectName: string; logs: string; loading: boolean; lines: number; filter: string }>({ open: false, projectId: "", projectName: "", logs: "", loading: false, lines: 10, filter: "" });
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", type: "pm2", path: "", domain: "", desc: "", pm2Name: "", containerName: "", deployCmd: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [healthResults, setHealthResults] = useState<HealthResult[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [linkDropdown, setLinkDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLPreElement>(null);
  const { clients, serverLinks, linkProjectToClient, unlinkProject } = useCRM();

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

  const handlePauseResume = async (projectId: string, isPaused: boolean) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const action = isPaused ? "resume" : "pause";
    setActionLoading(prev => ({ ...prev, [projectId]: action }));
    try {
      const res = await fetch(`/api/vps/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${project.name}: ${isPaused ? "Reanudado" : "Pausado"} exitosamente`, "success");
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

  const handleDelete = async (project: ProjectInfo) => {
    if (!window.confirm(`¿Eliminar ${project.name} del monitoreo? Los archivos no se borran.`)) return;
    setActionLoading(prev => ({ ...prev, [project.id]: "delete" }));
    try {
      const res = await fetch("/api/vps/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${project.name} eliminado del monitoreo`, "success");
        fetchStatus();
      } else {
        showToast(data.error || "Error al eliminar", "error");
      }
    } catch {
      showToast("Error de conexion", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [project.id]: null }));
    }
  };

  const handleAddProject = async () => {
    if (!addForm.name || !addForm.type) return;
    setAddLoading(true);
    try {
      const body: Record<string, string> = { name: addForm.name, type: addForm.type };
      if (addForm.path) body.path = addForm.path;
      if (addForm.domain) body.domain = addForm.domain;
      if (addForm.desc) body.desc = addForm.desc;
      if (addForm.pm2Name) body.pm2Name = addForm.pm2Name;
      if (addForm.containerName) body.containerName = addForm.containerName;
      if (addForm.deployCmd) body.deployCmd = addForm.deployCmd;
      const res = await fetch("/api/vps/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Proyecto agregado exitosamente", "success");
        setAddModal(false);
        setAddForm({ name: "", type: "pm2", path: "", domain: "", desc: "", pm2Name: "", containerName: "", deployCmd: "" });
        fetchStatus();
      } else {
        showToast(data.error || "Error al agregar", "error");
      }
    } catch {
      showToast("Error de conexion", "error");
    } finally {
      setAddLoading(false);
    }
  };

  const fetchLogs = async (projectId: string, projectName: string, lines?: number, filter?: string) => {
    const l = lines ?? logsModal.lines;
    const f = filter ?? logsModal.filter;
    setLogsModal(prev => ({ ...prev, open: true, projectId, projectName, logs: "", loading: true, lines: l, filter: f }));
    try {
      let url = `/api/vps/logs?project=${projectId}&lines=${l}`;
      if (f) url += `&filter=${encodeURIComponent(f)}`;
      const res = await fetch(url);
      const data = await res.json();
      setLogsModal(prev => ({ ...prev, logs: data.logs || "Sin logs", loading: false }));
    } catch {
      setLogsModal(prev => ({ ...prev, logs: "Error al obtener logs", loading: false }));
    }
  };

  const refreshLogs = () => {
    if (logsModal.projectId) {
      fetchLogs(logsModal.projectId, logsModal.projectName, logsModal.lines, logsModal.filter);
    }
  };

  useEffect(() => {
    if (!logsModal.loading && logsModal.logs && logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
    }
  }, [logsModal.logs, logsModal.loading]);

  const handleHealthCheck = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/vps/health");
      const data = await res.json();
      if (Array.isArray(data)) {
        setHealthResults(data);
        setTimeout(() => setHealthResults([]), 5000);
      }
    } catch {
      showToast("Error al verificar health", "error");
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    if (!logsModal.open && !addModal) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLogsModal(prev => ({ ...prev, open: false }));
        setAddModal(false);
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [logsModal.open, addModal]);

  useEffect(() => {
    if (!linkDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLinkDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [linkDropdown]);

  const activeCount = projects.filter(p => {
    const s = p.status.toLowerCase();
    return s.startsWith("up") || s === "online";
  }).length;

  const diskPct = server?.diskPercent ? parseInt(server.diskPercent) : 0;

  const hasLogs = (p: ProjectInfo) => p.type === "pm2" || p.type === "docker" || p.type === "docker-compose";
  const isPaused = (p: ProjectInfo) => !p.active || p.status === "paused";
  const isManual = (p: ProjectInfo) => p.type === "manual";
  const getHealth = (id: string) => healthResults.find(h => h.id === id);

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
        <div className="flex items-center gap-2">
          <button
            onClick={handleHealthCheck}
            disabled={healthLoading}
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#0F0F12] px-3 py-2 text-[13px] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors duration-150 disabled:opacity-50"
          >
            {healthLoading ? <Spinner /> : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            )}
            Health
          </button>
          <button
            onClick={() => setAddModal(true)}
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#0F0F12] px-3 py-2 text-[13px] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors duration-150"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar
          </button>
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
      </div>

      {/* Server stats */}
      {loading ? (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : server && (
        <div className="grid grid-cols-4 gap-3 mb-6">
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

          <div className="rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01"/>
              </svg>
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider">RAM</span>
            </div>
            <div className="text-lg font-bold text-white">{server.memUsed}<span className="text-[13px] text-zinc-500 font-normal"> / {server.memTotal}</span></div>
          </div>

          <div className="rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Uptime</span>
            </div>
            <div className="text-lg font-bold text-white">{server.uptime.replace("up ", "")}</div>
          </div>

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
            const paused = isPaused(project);
            const manual = isManual(project);
            const badge = getStatusBadge(project.status, project.active);
            const isActioning = actionLoading[project.id];
            const health = getHealth(project.id);

            return (
              <div
                key={project.id}
                className={`rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-5 hover:border-zinc-700 transition-all duration-150 ${paused ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-[15px] font-semibold text-white">{project.name}</span>
                      <TypeBadge type={project.type} />
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      {health && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          health.ok
                            ? "bg-green-500/10 text-green-400"
                            : "bg-red-500/10 text-red-400"
                        }`}>
                          {health.ok ? `${health.statusCode} OK` : health.error ? "Down" : `${health.statusCode}`}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-zinc-500 mb-2">{project.description}</p>
                    <div className="flex items-center gap-4 text-[12px] text-zinc-600 mb-2">
                      {(() => {
                        const linkedClientId = serverLinks[project.id];
                        const linkedClient = linkedClientId ? clients.find(c => c.id === linkedClientId) : null;
                        if (linkedClient) {
                          const initials = linkedClient.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                          return (
                            <span className="inline-flex items-center gap-1.5 bg-zinc-800/50 rounded-full pl-1 pr-2 py-0.5 text-[11px] text-zinc-300">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0EA5E9]/20 text-[#0EA5E9] text-[9px] font-bold flex-shrink-0">
                                {initials}
                              </span>
                              {linkedClient.name}
                              <button
                                onClick={() => unlinkProject(project.id)}
                                className="ml-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </span>
                          );
                        }
                        return (
                          <div className="relative" ref={linkDropdown === project.id ? dropdownRef : undefined}>
                            <button
                              onClick={() => setLinkDropdown(linkDropdown === project.id ? null : project.id)}
                              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
                            >
                              + Vincular cliente
                            </button>
                            {linkDropdown === project.id && (
                              <div className="absolute top-full left-0 mt-1 z-40 bg-[#0F0F12] border border-zinc-800 rounded-lg shadow-lg p-2 w-[200px] max-h-[200px] overflow-y-auto">
                                {clients.length === 0 ? (
                                  <p className="text-[11px] text-zinc-500 px-2 py-1">Sin clientes registrados</p>
                                ) : (
                                  clients.map(client => {
                                    const initials = client.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                                    return (
                                      <button
                                        key={client.id}
                                        onClick={() => { linkProjectToClient(project.id, client.id); setLinkDropdown(null); }}
                                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-[12px] text-zinc-300 hover:bg-zinc-800 transition-colors text-left"
                                      >
                                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0EA5E9]/20 text-[#0EA5E9] text-[9px] font-bold flex-shrink-0">
                                          {initials}
                                        </span>
                                        {client.name}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
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

                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {/* Logs */}
                    {!manual && hasLogs(project) && (
                      <button
                        onClick={() => fetchLogs(project.id, project.name, 10, "")}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all duration-150"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                        </svg>
                        Logs
                      </button>
                    )}
                    {/* Pause/Resume */}
                    {!manual && (
                      <button
                        onClick={() => handlePauseResume(project.id, paused)}
                        disabled={!!isActioning}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] transition-all duration-150 disabled:opacity-50 ${
                          paused
                            ? "border-green-700/50 text-green-400 hover:bg-green-900/20 hover:text-green-300"
                            : "border-amber-700/50 text-amber-400 hover:bg-amber-900/20 hover:text-amber-300"
                        }`}
                      >
                        {isActioning === "pause" || isActioning === "resume" ? <Spinner /> : paused ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                          </svg>
                        )}
                        {paused ? "Reanudar" : "Pausar"}
                      </button>
                    )}
                    {/* Restart */}
                    {!manual && (
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
                    )}
                    {/* Deploy */}
                    {!manual && (
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
                    )}
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(project)}
                      disabled={!!isActioning}
                      className="flex items-center justify-center rounded-lg border border-zinc-800 p-1.5 text-zinc-600 hover:text-red-400 hover:border-red-800/50 transition-all duration-150 disabled:opacity-50"
                      title="Eliminar del monitoreo"
                    >
                      {isActioning === "delete" ? <Spinner /> : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Logs Modal */}
      {logsModal.open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[60px]"
          onClick={() => setLogsModal(prev => ({ ...prev, open: false }))}
        >
          <div
            className="bg-[#0F0F12] border border-zinc-800 rounded-[14px] p-5 w-full max-w-[700px] max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-white">Logs — {logsModal.projectName}</span>
              <button
                onClick={() => setLogsModal(prev => ({ ...prev, open: false }))}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Logs controls */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-zinc-500 mr-1">Líneas:</span>
                {[10, 25, 50, 100].map(n => (
                  <button
                    key={n}
                    onClick={() => {
                      setLogsModal(prev => ({ ...prev, lines: n }));
                      fetchLogs(logsModal.projectId, logsModal.projectName, n, logsModal.filter);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                      logsModal.lines === n
                        ? "bg-[#0EA5E9]/20 text-[#0EA5E9] font-medium"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={logsModal.filter}
                onChange={e => setLogsModal(prev => ({ ...prev, filter: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") refreshLogs(); }}
                placeholder="Filtrar por keyword..."
                className="flex-1 min-w-[150px] rounded-lg border border-zinc-800 bg-[#09090B] px-3 py-1.5 text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-700"
              />
              <button
                onClick={refreshLogs}
                disabled={logsModal.loading}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all duration-150 disabled:opacity-50"
              >
                {logsModal.loading ? <Spinner /> : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                )}
                Actualizar
              </button>
            </div>

            {logsModal.loading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : (
              <pre
                ref={logsEndRef}
                className="bg-[#09090B] border border-zinc-800 rounded-lg p-4 font-mono text-[12px] text-zinc-300 leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[400px] overflow-y-auto"
              >
                {logsModal.logs}
              </pre>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setLogsModal(prev => ({ ...prev, open: false }))}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all duration-150"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {addModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[60px]"
          onClick={() => setAddModal(false)}
        >
          <div
            className="bg-[#0F0F12] border border-zinc-800 rounded-[14px] p-5 w-full max-w-[500px] max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-white">Agregar proyecto</span>
              <button
                onClick={() => setAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800 bg-[#09090B] px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-zinc-700"
                  placeholder="Mi Proyecto"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Tipo *</label>
                <select
                  value={addForm.type}
                  onChange={e => setAddForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800 bg-[#09090B] px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-zinc-700"
                >
                  <option value="pm2">PM2</option>
                  <option value="docker">Docker</option>
                  <option value="docker-compose">Docker Compose</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Ruta en servidor</label>
                <input
                  type="text"
                  value={addForm.path}
                  onChange={e => setAddForm(prev => ({ ...prev, path: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800 bg-[#09090B] px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-zinc-700"
                  placeholder="/home/ubuntu/mi-proyecto"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Dominio</label>
                <input
                  type="text"
                  value={addForm.domain}
                  onChange={e => setAddForm(prev => ({ ...prev, domain: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800 bg-[#09090B] px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-zinc-700"
                  placeholder="midominio.com"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Descripción</label>
                <input
                  type="text"
                  value={addForm.desc}
                  onChange={e => setAddForm(prev => ({ ...prev, desc: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800 bg-[#09090B] px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-zinc-700"
                />
              </div>
              {addForm.type === "pm2" && (
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">Nombre PM2</label>
                  <input
                    type="text"
                    value={addForm.pm2Name}
                    onChange={e => setAddForm(prev => ({ ...prev, pm2Name: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-800 bg-[#09090B] px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-zinc-700"
                    placeholder="nombre en pm2"
                  />
                </div>
              )}
              {(addForm.type === "docker" || addForm.type === "docker-compose") && (
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">Nombre Container</label>
                  <input
                    type="text"
                    value={addForm.containerName}
                    onChange={e => setAddForm(prev => ({ ...prev, containerName: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-800 bg-[#09090B] px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-zinc-700"
                  />
                </div>
              )}
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Deploy command <span className="text-zinc-700">(se auto-genera si se deja vacío)</span></label>
                <textarea
                  value={addForm.deployCmd}
                  onChange={e => setAddForm(prev => ({ ...prev, deployCmd: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800 bg-[#09090B] px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-zinc-700 resize-none h-[60px]"
                  placeholder="se auto-genera si se deja vacío"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setAddModal(false)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all duration-150"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddProject}
                disabled={!addForm.name || !addForm.type || addLoading}
                className="flex items-center gap-1.5 rounded-lg bg-[#0EA5E9] px-4 py-1.5 text-[12px] font-medium text-white hover:bg-[#0284C7] transition-all duration-150 disabled:opacity-50"
              >
                {addLoading ? <Spinner /> : null}
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
