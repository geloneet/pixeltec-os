"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useCRM } from "./CRMContext";
import { Modal } from "./Modal";
import { PRIORITIES } from "@/types/crm";
import type { CRMTask } from "@/types/crm";

type ModalType = { type: string; data?: Record<string, string> } | null;
type PomoMode = "work" | "break";
type PomoRef = { cid: string; pid: string; tid: string } | null;

interface CRMShellContextValue {
  modal: ModalType;
  setModal: (m: ModalType) => void;
  pomoRunning: boolean;
  pomoSeconds: number;
  pomoMode: PomoMode;
  pomoSessions: number;
  pomoTaskRef: PomoRef;
  startPomo: (cid: string, pid: string, tid: string) => void;
  stopPomo: () => void;
  resetPomo: () => void;
}

const Ctx = createContext<CRMShellContextValue | null>(null);

export function useCRMShell() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCRMShell must be used within CRMShellProvider");
  return ctx;
}

export function CRMShellProvider({ children }: { children: ReactNode }) {
  const crm = useCRM();
  const pathname = usePathname() || "";

  // Derive selected IDs from URL so modal submit has context
  const segments = pathname.split("/").filter(Boolean);
  let urlClientId: string | null = null;
  let urlProjectId: string | null = null;
  let urlToolId: string | null = null;

  if (segments[0] === "clientes" && segments[1]) {
    urlClientId = segments[1];
  }
  if (segments[0] === "proyectos" && segments[1]) {
    urlProjectId = segments[1];
    for (const c of crm.clients) {
      if (c.projects.some((p) => p.id === urlProjectId)) {
        urlClientId = c.id;
        break;
      }
    }
  }
  if (segments[0] === "herramientas" && segments[1]) {
    urlToolId = segments[1];
  }

  // Modal state
  const [modal, setModal] = useState<ModalType>(null);
  const formRefs = useRef<
    Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>
  >({});

  // Pomodoro state
  const [pomoRunning, setPomoRunning] = useState(false);
  const [pomoSeconds, setPomoSeconds] = useState(1500);
  const [pomoMode, setPomoMode] = useState<PomoMode>("work");
  const [pomoSessions, setPomoSessions] = useState(0);
  const [pomoTaskRef, setPomoTaskRef] = useState<PomoRef>(null);
  const pomoInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPomo = useCallback(() => {
    if (pomoInterval.current) clearInterval(pomoInterval.current);
    pomoInterval.current = null;
    setPomoRunning(false);
  }, []);

  const startPomo = useCallback(
    (cid: string, pid: string, tid: string) => {
      stopPomo();
      setPomoTaskRef({ cid, pid, tid });
      setPomoMode("work");
      setPomoSeconds(1500);
      setPomoRunning(true);
    },
    [stopPomo],
  );

  const resetPomo = useCallback(() => {
    stopPomo();
    setPomoSeconds(1500);
    setPomoMode("work");
  }, [stopPomo]);

  // Pomodoro tick
  useEffect(() => {
    if (!pomoRunning) return;
    pomoInterval.current = setInterval(() => {
      setPomoSeconds((prev) => {
        if (prev <= 1) {
          if (pomoMode === "work") {
            setPomoSessions((s) => s + 1);
            if (pomoTaskRef) {
              crm.updateTask(pomoTaskRef.cid, pomoTaskRef.pid, pomoTaskRef.tid, {
                pomoSessions: (() => {
                  const client = crm.clients.find((c) => c.id === pomoTaskRef.cid);
                  const project = client?.projects.find((p) => p.id === pomoTaskRef.pid);
                  const task = project?.tasks.find((t) => t.id === pomoTaskRef.tid);
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

  // ESC closes modal (Modal also has this, kept for symmetry with SPA)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modal) setModal(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modal]);

  const handleModalSubmit = () => {
    if (!modal) return;
    const val = (key: string) =>
      (formRefs.current[key] as HTMLInputElement)?.value || "";

    switch (modal.type) {
      case "addClient":
        if (!val("name").trim()) return;
        crm.addClient({
          name: val("name"),
          email: val("email"),
          phone: val("phone"),
          location: val("location"),
          notes: val("notes"),
        });
        break;
      case "editClient":
        if (!modal.data?.id) return;
        crm.updateClient(modal.data.id, {
          name: val("name"),
          email: val("email"),
          phone: val("phone"),
          location: val("location"),
          notes: val("notes"),
        });
        break;
      case "addProject":
        if (!urlClientId || !val("name").trim()) return;
        crm.addProject(urlClientId, {
          name: val("name"),
          domain: val("domain"),
          budget: val("budget"),
          annual: val("annual"),
          tech: val("tech"),
        });
        break;
      case "editProject":
        if (!urlClientId || !modal.data?.id) return;
        crm.updateProject(urlClientId, modal.data.id, {
          name: val("name"),
          domain: val("domain"),
          budget: val("budget"),
          annual: val("annual"),
          tech: val("tech"),
          accounts: val("accounts"),
          guides: val("guides"),
        });
        break;
      case "addTask":
        if (!urlClientId || !urlProjectId || !val("name").trim()) return;
        crm.addTask(urlClientId, urlProjectId, {
          name: val("name"),
          desc: val("desc"),
          prio: val("prio") as CRMTask["prio"],
        });
        break;
      case "addKey":
        if (!urlClientId || !urlProjectId) return;
        crm.addKey(urlClientId, urlProjectId, { label: val("label"), value: val("value") });
        break;
      case "editReadme":
        if (!urlClientId || !urlProjectId) return;
        crm.updateProject(urlClientId, urlProjectId, { readme: val("content") });
        break;
      case "editPrompt":
        if (!urlClientId || !urlProjectId) return;
        crm.updateProject(urlClientId, urlProjectId, { prompt: val("content") });
        break;
      case "addTool":
        if (!val("name").trim()) return;
        crm.addTool({
          name: val("name"),
          icon: val("icon") || "⚙",
          color: val("color") || "#0EA5E9",
        });
        break;
      case "editTool":
        if (!modal.data?.id || !val("name").trim()) return;
        crm.updateTool(modal.data.id, {
          name: val("name"),
          icon: val("icon"),
          color: val("color"),
        });
        break;
      case "addTip": {
        if (!urlToolId || !val("title").trim()) return;
        const tags = val("tags")
          ? val("tags").split(",").map((t) => t.trim()).filter(Boolean)
          : [];
        crm.addTip(urlToolId, {
          title: val("title"),
          summary: val("summary"),
          content: val("content"),
          tags,
        });
        break;
      }
      case "editTip": {
        if (!urlToolId || !modal.data?.id || !val("title").trim()) return;
        const tags = val("tags")
          ? val("tags").split(",").map((t) => t.trim()).filter(Boolean)
          : [];
        crm.updateTip(urlToolId, modal.data.id, {
          title: val("title"),
          summary: val("summary"),
          content: val("content"),
          tags,
        });
        break;
      }
      case "addCharge":
        if (!urlClientId || !urlProjectId || !val("concept").trim() || !val("amount").trim())
          return;
        crm.addCharge(urlClientId, urlProjectId, {
          concept: val("concept"),
          amount: val("amount"),
          frequency: val("frequency") as "monthly" | "annual",
          startDate: val("startDate"),
          clientEmail: val("clientEmail"),
        });
        break;
      case "editCharge":
        if (!urlClientId || !urlProjectId || !modal.data?.id || !val("concept").trim()) return;
        crm.updateCharge(urlClientId, urlProjectId, modal.data.id, {
          concept: val("concept"),
          amount: val("amount"),
          frequency: val("frequency") as "monthly" | "annual",
          startDate: val("startDate"),
          clientEmail: val("clientEmail"),
        });
        break;
    }
    setModal(null);
  };

  const renderModal = () => {
    if (!modal) return null;
    const ref =
      (key: string) =>
      (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => {
        formRefs.current[key] = el;
      };
    const inputClass =
      "w-full bg-[#18181B] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#0EA5E9] transition-colors duration-150";
    const labelClass = "block text-xs text-zinc-500 mb-1";

    let title = "";
    let subtitle: string | undefined;
    let content: ReactNode = null;

    switch (modal.type) {
      case "addClient":
      case "editClient": {
        title = modal.type === "addClient" ? "Nuevo cliente" : "Editar cliente";
        content = (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Nombre *</label>
              <input
                ref={ref("name")}
                className={inputClass}
                defaultValue={modal.data?.name || ""}
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input ref={ref("phone")} className={inputClass} defaultValue={modal.data?.phone || ""} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                ref={ref("email")}
                type="email"
                className={inputClass}
                placeholder="cliente@empresa.com"
                defaultValue={modal.data?.email || ""}
              />
            </div>
            <div>
              <label className={labelClass}>Ubicación</label>
              <input
                ref={ref("location")}
                className={inputClass}
                defaultValue={modal.data?.location || ""}
              />
            </div>
            <div>
              <label className={labelClass}>Notas</label>
              <textarea
                ref={ref("notes")}
                className={inputClass + " h-20 resize-none"}
                defaultValue={modal.data?.notes || ""}
              />
            </div>
          </div>
        );
        break;
      }
      case "addProject":
      case "editProject": {
        title = modal.type === "addProject" ? "Nuevo proyecto" : "Editar proyecto";
        content = (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Nombre *</label>
              <input
                ref={ref("name")}
                className={inputClass}
                defaultValue={modal.data?.name || ""}
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Dominio</label>
              <input
                ref={ref("domain")}
                className={inputClass}
                defaultValue={modal.data?.domain || ""}
              />
            </div>
            <div>
              <label className={labelClass}>Presupuesto</label>
              <input
                ref={ref("budget")}
                className={inputClass}
                defaultValue={modal.data?.budget || ""}
              />
            </div>
            <div>
              <label className={labelClass}>Costos anuales</label>
              <input
                ref={ref("annual")}
                className={inputClass}
                defaultValue={modal.data?.annual || ""}
              />
            </div>
            <div>
              <label className={labelClass}>Tecnologías</label>
              <input
                ref={ref("tech")}
                className={inputClass}
                defaultValue={modal.data?.tech || ""}
              />
            </div>
            {modal.type === "editProject" && (
              <>
                <div>
                  <label className={labelClass}>Cuentas</label>
                  <textarea
                    ref={ref("accounts")}
                    className={inputClass + " h-20 resize-none"}
                    defaultValue={modal.data?.accounts || ""}
                  />
                </div>
                <div>
                  <label className={labelClass}>Guías</label>
                  <textarea
                    ref={ref("guides")}
                    className={inputClass + " h-20 resize-none"}
                    defaultValue={modal.data?.guides || ""}
                  />
                </div>
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
            <div>
              <label className={labelClass}>Nombre *</label>
              <input ref={ref("name")} className={inputClass} autoFocus />
            </div>
            <div>
              <label className={labelClass}>Descripción</label>
              <textarea ref={ref("desc")} className={inputClass + " h-20 resize-none"} />
            </div>
            <div>
              <label className={labelClass}>Prioridad</label>
              <select ref={ref("prio")} className={inputClass} defaultValue="important">
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
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
            <div>
              <label className={labelClass}>Etiqueta</label>
              <input ref={ref("label")} className={inputClass} autoFocus />
            </div>
            <div>
              <label className={labelClass}>Valor</label>
              <input ref={ref("value")} className={inputClass} />
            </div>
          </div>
        );
        break;
      }
      case "editReadme": {
        title = "Editar README";
        content = (
          <textarea
            ref={ref("content")}
            className={inputClass + " h-64 resize-none font-mono text-xs"}
            defaultValue={modal.data?.content || ""}
            autoFocus
          />
        );
        break;
      }
      case "editPrompt": {
        title = "Editar Prompt IA";
        subtitle =
          "Este prompt se usará como contexto para asistentes de IA al trabajar en este proyecto.";
        content = (
          <textarea
            ref={ref("content")}
            className={inputClass + " h-64 resize-none font-mono text-xs"}
            defaultValue={modal.data?.content || ""}
            autoFocus
          />
        );
        break;
      }
      case "addTool":
      case "editTool": {
        title = modal.type === "addTool" ? "Nueva herramienta" : "Editar herramienta";
        const TOOL_COLORS = [
          "#0EA5E9",
          "#14b8a6",
          "#f59e0b",
          "#ef4444",
          "#3b82f6",
          "#22c55e",
          "#ec4899",
          "#f97316",
        ];
        const defaultColor = modal.data?.color || TOOL_COLORS[0];
        content = (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Nombre *</label>
              <input
                ref={ref("name")}
                className={inputClass}
                defaultValue={modal.data?.name || ""}
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Icono</label>
              <input
                ref={ref("icon")}
                className={inputClass}
                placeholder="Ej: ⚡ o CC"
                maxLength={2}
                defaultValue={modal.data?.icon || ""}
              />
            </div>
            <div>
              <label className={labelClass}>Color</label>
              <input type="hidden" ref={ref("color")} defaultValue={defaultColor} />
              <div className="flex gap-2 mt-1">
                {TOOL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (formRefs.current["color"])
                        (formRefs.current["color"] as HTMLInputElement).value = c;
                      document
                        .querySelectorAll("[data-color-btn]")
                        .forEach((el) => ((el as HTMLElement).style.outline = "none"));
                      const target = document.querySelector(`[data-color-btn="${c}"]`) as
                        | HTMLElement
                        | null;
                      if (target) target.style.outline = "2px solid white";
                    }}
                    data-color-btn={c}
                    className="w-7 h-7 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: c,
                      outline: c === defaultColor ? "2px solid white" : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
        break;
      }
      case "addCharge":
      case "editCharge": {
        title = modal.type === "addCharge" ? "Nuevo cobro recurrente" : "Editar cobro";
        content = (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Concepto *</label>
              <input
                ref={ref("concept")}
                className={inputClass}
                placeholder="Hosting anual, Mantenimiento mensual, Dominio .mx"
                defaultValue={modal.data?.concept || ""}
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Monto (MXN) *</label>
              <input
                ref={ref("amount")}
                type="number"
                className={inputClass}
                placeholder="15000"
                defaultValue={modal.data?.amount || ""}
              />
            </div>
            <div>
              <label className={labelClass}>Frecuencia *</label>
              <select
                ref={ref("frequency")}
                className={inputClass}
                defaultValue={modal.data?.frequency || "annual"}
              >
                <option value="monthly">Mensual</option>
                <option value="annual">Anual</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Fecha de inicio *</label>
              <input
                ref={ref("startDate")}
                type="date"
                className={inputClass}
                defaultValue={modal.data?.startDate || ""}
              />
            </div>
            <div>
              <label className={labelClass}>Email del cliente</label>
              <input
                ref={ref("clientEmail")}
                type="email"
                className={inputClass}
                placeholder="cliente@empresa.com"
                defaultValue={modal.data?.clientEmail || ""}
              />
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
            <div>
              <label className={labelClass}>Título *</label>
              <input
                ref={ref("title")}
                className={inputClass}
                defaultValue={modal.data?.title || ""}
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Resumen</label>
              <input
                ref={ref("summary")}
                className={inputClass}
                placeholder="Descripción corta de 1 línea"
                defaultValue={modal.data?.summary || ""}
              />
            </div>
            <div>
              <label className={labelClass}>Contenido</label>
              <textarea
                ref={ref("content")}
                className={inputClass + " min-h-[200px] resize-none font-mono text-xs"}
                style={{ minHeight: "200px" }}
                placeholder="Detalle completo del tip, comandos, explicación..."
                defaultValue={modal.data?.content || ""}
              />
            </div>
            <div>
              <label className={labelClass}>Tags</label>
              <input
                ref={ref("tags")}
                className={inputClass}
                placeholder="Separados por coma: tokens, ahorro, config"
                defaultValue={modal.data?.tags || ""}
              />
            </div>
          </div>
        );
        break;
      }
    }

    return (
      <Modal open onClose={() => setModal(null)} title={title} subtitle={subtitle}>
        {content}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setModal(null)}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors duration-150"
          >
            Cancelar
          </button>
          <button
            onClick={handleModalSubmit}
            className="px-4 py-2 text-sm bg-[#0EA5E9] text-white rounded-lg hover:bg-[#0284C7] transition-all duration-150"
          >
            Guardar
          </button>
        </div>
      </Modal>
    );
  };

  return (
    <Ctx.Provider
      value={{
        modal,
        setModal,
        pomoRunning,
        pomoSeconds,
        pomoMode,
        pomoSessions,
        pomoTaskRef,
        startPomo,
        stopPomo,
        resetPomo,
      }}
    >
      {children}
      {renderModal()}
    </Ctx.Provider>
  );
}
