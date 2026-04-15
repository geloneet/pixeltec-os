"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCRM } from "@/components/crm/CRMContext";
import { Sidebar } from "@/components/crm/Sidebar";
import { TodayView } from "@/components/crm/TodayView";
import { ClientsView } from "@/components/crm/ClientsView";
import { ClientDetail } from "@/components/crm/ClientDetail";
import { ProjectView } from "@/components/crm/ProjectView";
import { SearchView } from "@/components/crm/SearchView";
import { ToolsView } from "@/components/crm/ToolsView";
import { ToolDetailView } from "@/components/crm/ToolDetailView";
import { ServerView } from "@/components/crm/ServerView";
import { Modal } from "@/components/crm/Modal";
import { PRIORITIES } from "@/types/crm";
import type { CRMTask } from "@/types/crm";

type View = "today" | "clients" | "client" | "project" | "search" | "tools" | "tool" | "server";
type ModalType = { type: string; data?: Record<string, string> } | null;
type PomoMode = "work" | "break";

export default function CRMPage() {
  const crm = useCRM();
  const [view, setView] = useState<View>("today");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [projectTab, setProjectTab] = useState("tareas");
  const [modal, setModal] = useState<ModalType>(null);

  // Pomodoro
  const [pomoRunning, setPomoRunning] = useState(false);
  const [pomoSeconds, setPomoSeconds] = useState(1500);
  const [pomoMode, setPomoMode] = useState<PomoMode>("work");
  const [pomoSessions, setPomoSessions] = useState(0);
  const [pomoTaskRef, setPomoTaskRef] = useState<{ cid: string; pid: string; tid: string } | null>(null);
  const pomoInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form refs
  const formRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>({});

  const stopPomo = useCallback(() => {
    if (pomoInterval.current) clearInterval(pomoInterval.current);
    pomoInterval.current = null;
    setPomoRunning(false);
  }, []);

  const startPomo = useCallback((cid: string, pid: string, tid: string) => {
    stopPomo();
    setPomoTaskRef({ cid, pid, tid });
    setPomoMode("work");
    setPomoSeconds(1500);
    setPomoRunning(true);
  }, [stopPomo]);

  const resetPomo = useCallback(() => {
    stopPomo();
    setPomoSeconds(1500);
    setPomoMode("work");
  }, [stopPomo]);

  // Pomodoro tick
  useEffect(() => {
    if (!pomoRunning) return;
    pomoInterval.current = setInterval(() => {
      setPomoSeconds(prev => {
        if (prev <= 1) {
          if (pomoMode === "work") {
            setPomoSessions(s => s + 1);
            if (pomoTaskRef) {
              crm.updateTask(pomoTaskRef.cid, pomoTaskRef.pid, pomoTaskRef.tid, {
                pomoSessions: (() => {
                  const client = crm.clients.find(c => c.id === pomoTaskRef.cid);
                  const project = client?.projects.find(p => p.id === pomoTaskRef.pid);
                  const task = project?.tasks.find(t => t.id === pomoTaskRef.tid);
                  return (task?.pomoSessions || 0) + 1;
                })(),
              });
            }
            setPomoMode("break");
            return 300;
          } else {
            setPomoMode("work");
            return 1500;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (pomoInterval.current) clearInterval(pomoInterval.current);
    };
  }, [pomoRunning, pomoMode, pomoTaskRef, crm]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        setView("search");
      }
      if (e.key === "Escape" && modal) {
        setModal(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modal]);

  const navigateToClient = (id: string) => {
    setSelectedClient(id);
    setView("client");
  };

  const navigateToProject = (clientId: string, projectId: string) => {
    setSelectedClient(clientId);
    setSelectedProject(projectId);
    setProjectTab("tareas");
    setView("project");
  };

  const navigateToTool = (toolId: string) => {
    setSelectedTool(toolId);
    setView("tool");
  };

  const handleModalSubmit = () => {
    if (!modal) return;
    const val = (key: string) => (formRefs.current[key] as HTMLInputElement)?.value || "";

    switch (modal.type) {
      case "addClient":
        if (!val("name").trim()) return;
        crm.addClient({ name: val("name"), phone: val("phone"), location: val("location"), notes: val("notes") });
        break;
      case "editClient":
        if (!modal.data?.id) return;
        crm.updateClient(modal.data.id, { name: val("name"), phone: val("phone"), location: val("location"), notes: val("notes") });
        break;
      case "addProject":
        if (!selectedClient || !val("name").trim()) return;
        crm.addProject(selectedClient, { name: val("name"), domain: val("domain"), budget: val("budget"), annual: val("annual"), tech: val("tech") });
        break;
      case "editProject":
        if (!selectedClient || !modal.data?.id) return;
        crm.updateProject(selectedClient, modal.data.id, { name: val("name"), domain: val("domain"), budget: val("budget"), annual: val("annual"), tech: val("tech"), accounts: val("accounts"), guides: val("guides") });
        break;
      case "addTask":
        if (!selectedClient || !selectedProject || !val("name").trim()) return;
        crm.addTask(selectedClient, selectedProject, { name: val("name"), desc: val("desc"), prio: val("prio") as CRMTask["prio"] });
        break;
      case "addKey":
        if (!selectedClient || !selectedProject) return;
        crm.addKey(selectedClient, selectedProject, { label: val("label"), value: val("value") });
        break;
      case "editReadme":
        if (!selectedClient || !selectedProject) return;
        crm.updateProject(selectedClient, selectedProject, { readme: val("content") });
        break;
      case "editPrompt":
        if (!selectedClient || !selectedProject) return;
        crm.updateProject(selectedClient, selectedProject, { prompt: val("content") });
        break;
      case "addTool": {
        if (!val("name").trim()) return;
        crm.addTool({ name: val("name"), icon: val("icon") || "⚙", color: val("color") || "#0EA5E9" });
        break;
      }
      case "editTool": {
        if (!modal.data?.id || !val("name").trim()) return;
        crm.updateTool(modal.data.id, { name: val("name"), icon: val("icon"), color: val("color") });
        break;
      }
      case "addTip": {
        if (!selectedTool || !val("title").trim()) return;
        const tags = val("tags") ? val("tags").split(",").map((t: string) => t.trim()).filter(Boolean) : [];
        crm.addTip(selectedTool, { title: val("title"), summary: val("summary"), content: val("content"), tags });
        break;
      }
      case "editTip": {
        if (!selectedTool || !modal.data?.id || !val("title").trim()) return;
        const editTags = val("tags") ? val("tags").split(",").map((t: string) => t.trim()).filter(Boolean) : [];
        crm.updateTip(selectedTool, modal.data.id, { title: val("title"), summary: val("summary"), content: val("content"), tags: editTags });
        break;
      }
    }
    setModal(null);
  };

  const renderModal = () => {
    if (!modal) return null;
    const ref = (key: string) => (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => { formRefs.current[key] = el; };
    const inputClass = "w-full bg-[#18181B] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#0EA5E9] transition-colors duration-150";
    const labelClass = "block text-xs text-zinc-500 mb-1";

    let title = "";
    let subtitle: string | undefined;
    let content: React.ReactNode = null;

    switch (modal.type) {
      case "addClient":
      case "editClient": {
        title = modal.type === "addClient" ? "Nuevo cliente" : "Editar cliente";
        content = (
          <div className="space-y-3">
            <div><label className={labelClass}>Nombre *</label><input ref={ref("name")} className={inputClass} defaultValue={modal.data?.name || ""} autoFocus /></div>
            <div><label className={labelClass}>Teléfono</label><input ref={ref("phone")} className={inputClass} defaultValue={modal.data?.phone || ""} /></div>
            <div><label className={labelClass}>Ubicación</label><input ref={ref("location")} className={inputClass} defaultValue={modal.data?.location || ""} /></div>
            <div><label className={labelClass}>Notas</label><textarea ref={ref("notes")} className={inputClass + " h-20 resize-none"} defaultValue={modal.data?.notes || ""} /></div>
          </div>
        );
        break;
      }
      case "addProject":
      case "editProject": {
        title = modal.type === "addProject" ? "Nuevo proyecto" : "Editar proyecto";
        content = (
          <div className="space-y-3">
            <div><label className={labelClass}>Nombre *</label><input ref={ref("name")} className={inputClass} defaultValue={modal.data?.name || ""} autoFocus /></div>
            <div><label className={labelClass}>Dominio</label><input ref={ref("domain")} className={inputClass} defaultValue={modal.data?.domain || ""} /></div>
            <div><label className={labelClass}>Presupuesto</label><input ref={ref("budget")} className={inputClass} defaultValue={modal.data?.budget || ""} /></div>
            <div><label className={labelClass}>Costos anuales</label><input ref={ref("annual")} className={inputClass} defaultValue={modal.data?.annual || ""} /></div>
            <div><label className={labelClass}>Tecnologías</label><input ref={ref("tech")} className={inputClass} defaultValue={modal.data?.tech || ""} /></div>
            {modal.type === "editProject" && (
              <>
                <div><label className={labelClass}>Cuentas</label><textarea ref={ref("accounts")} className={inputClass + " h-20 resize-none"} defaultValue={modal.data?.accounts || ""} /></div>
                <div><label className={labelClass}>Guías</label><textarea ref={ref("guides")} className={inputClass + " h-20 resize-none"} defaultValue={modal.data?.guides || ""} /></div>
              </>
            )}
          </div>
        );
        break;
      }
      case "addTask": {
        title = "Nueva tarea";
        content = (
          <div className="space-y-3">
            <div><label className={labelClass}>Nombre *</label><input ref={ref("name")} className={inputClass} autoFocus /></div>
            <div><label className={labelClass}>Descripción</label><textarea ref={ref("desc")} className={inputClass + " h-20 resize-none"} /></div>
            <div>
              <label className={labelClass}>Prioridad</label>
              <select ref={ref("prio")} className={inputClass} defaultValue="important">
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
        );
        break;
      }
      case "addKey": {
        title = "Nueva llave";
        content = (
          <div className="space-y-3">
            <div><label className={labelClass}>Etiqueta</label><input ref={ref("label")} className={inputClass} autoFocus /></div>
            <div><label className={labelClass}>Valor</label><input ref={ref("value")} className={inputClass} /></div>
          </div>
        );
        break;
      }
      case "editReadme": {
        title = "Editar README";
        content = <textarea ref={ref("content")} className={inputClass + " h-64 resize-none font-mono text-xs"} defaultValue={modal.data?.content || ""} autoFocus />;
        break;
      }
      case "editPrompt": {
        title = "Editar Prompt IA";
        subtitle = "Este prompt se usará como contexto para asistentes de IA al trabajar en este proyecto.";
        content = <textarea ref={ref("content")} className={inputClass + " h-64 resize-none font-mono text-xs"} defaultValue={modal.data?.content || ""} autoFocus />;
        break;
      }
      case "addTool":
      case "editTool": {
        title = modal.type === "addTool" ? "Nueva herramienta" : "Editar herramienta";
        const TOOL_COLORS = ["#0EA5E9", "#14b8a6", "#f59e0b", "#ef4444", "#3b82f6", "#22c55e", "#ec4899", "#f97316"];
        const defaultColor = modal.data?.color || TOOL_COLORS[0];
        content = (
          <div className="space-y-3">
            <div><label className={labelClass}>Nombre *</label><input ref={ref("name")} className={inputClass} defaultValue={modal.data?.name || ""} autoFocus /></div>
            <div><label className={labelClass}>Icono</label><input ref={ref("icon")} className={inputClass} placeholder="Ej: ⚡ o CC" maxLength={2} defaultValue={modal.data?.icon || ""} /></div>
            <div>
              <label className={labelClass}>Color</label>
              <input type="hidden" ref={ref("color")} defaultValue={defaultColor} />
              <div className="flex gap-2 mt-1">
                {TOOL_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { if (formRefs.current["color"]) (formRefs.current["color"] as HTMLInputElement).value = c; document.querySelectorAll("[data-color-btn]").forEach(el => (el as HTMLElement).style.outline = "none"); (document.querySelector(`[data-color-btn="${c}"]`) as HTMLElement).style.outline = "2px solid white"; }}
                    data-color-btn={c}
                    className="w-7 h-7 rounded-full flex-shrink-0"
                    style={{ backgroundColor: c, outline: c === defaultColor ? "2px solid white" : "none", outlineOffset: "2px" }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
        break;
      }
      case "addTip":
      case "editTip": {
        title = modal.type === "addTip" ? "Nuevo tip" : "Editar tip";
        content = (
          <div className="space-y-3">
            <div><label className={labelClass}>Título *</label><input ref={ref("title")} className={inputClass} defaultValue={modal.data?.title || ""} autoFocus /></div>
            <div><label className={labelClass}>Resumen</label><input ref={ref("summary")} className={inputClass} placeholder="Descripción corta de 1 línea" defaultValue={modal.data?.summary || ""} /></div>
            <div><label className={labelClass}>Contenido</label><textarea ref={ref("content")} className={inputClass + " min-h-[200px] resize-none font-mono text-xs"} style={{ minHeight: "200px" }} placeholder="Detalle completo del tip, comandos, explicación..." defaultValue={modal.data?.content || ""} /></div>
            <div><label className={labelClass}>Tags</label><input ref={ref("tags")} className={inputClass} placeholder="Separados por coma: tokens, ahorro, config" defaultValue={modal.data?.tags || ""} /></div>
          </div>
        );
        break;
      }
    }

    return (
      <Modal open onClose={() => setModal(null)} title={title} subtitle={subtitle}>
        {content}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors duration-150">Cancelar</button>
          <button onClick={handleModalSubmit} className="px-4 py-2 text-sm bg-[#0EA5E9] text-white rounded-lg hover:bg-[#0284C7] transition-all duration-150">Guardar</button>
        </div>
      </Modal>
    );
  };

  if (crm.loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#09090B]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0EA5E9] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#09090B] text-zinc-200">
      <Sidebar
        view={view}
        setView={setView}
        clients={crm.clients}
        navigateToClient={navigateToClient}
        setModal={setModal}
        streak={crm.streak}
        pomoRunning={pomoRunning}
        pomoSeconds={pomoSeconds}
        pomoMode={pomoMode}
      />
      <main className="flex-1 overflow-y-auto p-6">
        {view === "today" && (
          <TodayView
            clients={crm.clients}
            navigateToClient={navigateToClient}
            navigateToProject={navigateToProject}
            setModal={setModal}
            cycleTaskStatus={crm.cycleTaskStatus}
            startPomo={startPomo}
          />
        )}
        {view === "clients" && (
          <ClientsView
            clients={crm.clients}
            navigateToClient={navigateToClient}
            setModal={setModal}
          />
        )}
        {view === "client" && selectedClient && (
          <ClientDetail
            client={crm.clients.find(c => c.id === selectedClient)!}
            setView={setView}
            navigateToProject={navigateToProject}
            setModal={setModal}
            deleteClient={crm.deleteClient}
          />
        )}
        {view === "project" && selectedClient && selectedProject && (
          <ProjectView
            client={crm.clients.find(c => c.id === selectedClient)!}
            project={crm.clients.find(c => c.id === selectedClient)!.projects.find(p => p.id === selectedProject)!}
            projectTab={projectTab}
            setProjectTab={setProjectTab}
            setView={setView}
            setModal={setModal}
            cycleTaskStatus={crm.cycleTaskStatus}
            deleteTask={crm.deleteTask}
            deleteKey={crm.deleteKey}
            deleteProject={crm.deleteProject}
            saveQuickNote={crm.saveQuickNote}
            startPomo={startPomo}
            pomoRunning={pomoRunning}
            pomoTaskRef={pomoTaskRef}
            pomoSeconds={pomoSeconds}
            pomoMode={pomoMode}
            pomoSessions={pomoSessions}
            stopPomo={stopPomo}
            resetPomo={resetPomo}
          />
        )}
        {view === "server" && <ServerView />}
        {view === "search" && (
          <SearchView
            clients={crm.clients}
            tools={crm.tools}
            navigateToClient={navigateToClient}
            navigateToProject={navigateToProject}
            navigateToTool={navigateToTool}
          />
        )}
        {view === "tools" && (
          <ToolsView
            tools={crm.tools}
            onSelectTool={navigateToTool}
            onAddTool={() => setModal({ type: "addTool" })}
          />
        )}
        {view === "tool" && selectedTool && crm.tools.find(t => t.id === selectedTool) && (
          <ToolDetailView
            tool={crm.tools.find(t => t.id === selectedTool)!}
            onBack={() => setView("tools")}
            onEditTool={() => {
              const t = crm.tools.find(t => t.id === selectedTool)!;
              setModal({ type: "editTool", data: { id: t.id, name: t.name, icon: t.icon, color: t.color } });
            }}
            onDeleteTool={() => { crm.deleteTool(selectedTool); setView("tools"); }}
            onAddTip={() => setModal({ type: "addTip" })}
            onEditTip={(tip) => setModal({ type: "editTip", data: { id: tip.id, title: tip.title, summary: tip.summary, content: tip.content, tags: tip.tags.join(", ") } })}
            onDeleteTip={(tipId) => crm.deleteTip(selectedTool, tipId)}
          />
        )}
      </main>
      {renderModal()}
    </div>
  );
}
