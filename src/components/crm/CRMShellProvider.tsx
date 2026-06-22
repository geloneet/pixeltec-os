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
  if (segments[0] === "accesos" && segments[1]) {
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
          contactName: val("contactName") || undefined,
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
          contactName: val("contactName") || undefined,
          email: val("email"),
          phone: val("phone"),
          location: val("location"),
          notes: val("notes"),
        });
        break;
      case "addProject":
        if (!urlClientId || !val("name").trim()) return;
        {
          const budget = Number(val("budget").replace(/[^\d]/g, "")) || 0;
          const annual = Number(val("annual").replace(/[^\d]/g, "")) || 0;
          const budgetIva = (val("budgetIva") || "none") as "none" | "plus" | "included";
          const annualIva = (val("annualIva") || "none") as "none" | "plus" | "included";
          crm.addProject(urlClientId, {
            name: val("name"),
            domain: val("domain"),
            budget,
            annual,
            budgetIva,
            annualIva,
            tech: val("tech"),
          });
        }
        break;
      case "editProject":
        if (!urlClientId || !modal.data?.id) return;
        {
          const budget = Number(val("budget").replace(/[^\d]/g, "")) || 0;
          const annual = Number(val("annual").replace(/[^\d]/g, "")) || 0;
          const budgetIva = (val("budgetIva") || "none") as "none" | "plus" | "included";
          const annualIva = (val("annualIva") || "none") as "none" | "plus" | "included";
          crm.updateProject(urlClientId, modal.data.id, {
            name: val("name"),
            domain: val("domain"),
            budget,
            annual,
            budgetIva,
            annualIva,
            tech: val("tech"),
            accounts: val("accounts"),
            guides: val("guides"),
          });
        }
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
    const sectionLabel = "text-[10px] font-semibold uppercase tracking-widest text-zinc-600 pt-2 pb-0.5";

    let title = "";
    let subtitle: string | undefined;
    let content: ReactNode = null;
    let submitLabel = "Guardar";

    switch (modal.type) {
      case "addClient":
      case "editClient": {
        title = modal.type === "addClient" ? "Nuevo cliente" : "Editar cliente";
        if (modal.type === "addClient") {
          subtitle = "Crea una nueva cuenta empresarial para gestionar proyectos, tareas, accesos y cobros.";
          submitLabel = "Crear cuenta";
        }
        content = (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-zinc-200 mb-1">Empresa / Razón social *</label>
                {modal.type === "addClient" && (
                  <p className="text-[10px] text-zinc-600 mb-1.5">Ej: Villa Nogal, Smile More</p>
                )}
                <input
                  ref={ref("name")}
                  className={inputClass + " font-medium"}
                  placeholder="Villa Nogal"
                  defaultValue={modal.data?.name || ""}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>Contacto principal</label>
                <input
                  ref={ref("contactName")}
                  className={inputClass}
                  placeholder="Aidee García"
                  defaultValue={modal.data?.contactName || ""}
                />
              </div>
              <div>
                <label className={labelClass}>Teléfono</label>
                <input
                  ref={ref("phone")}
                  className={inputClass}
                  placeholder="+52 322 123 4567"
                  defaultValue={modal.data?.phone || ""}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  ref={ref("email")}
                  type="email"
                  className={inputClass}
                  placeholder="contacto@empresa.com"
                  defaultValue={modal.data?.email || ""}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Ubicación</label>
              <input
                ref={ref("location")}
                className={inputClass}
                placeholder="Puerto Vallarta, Jalisco"
                defaultValue={modal.data?.location || ""}
              />
            </div>
            <div>
              <label className={labelClass}>
                Notas internas <span className="text-zinc-600">(opcional)</span>
              </label>
              <textarea
                ref={ref("notes")}
                className={inputClass + " h-16 resize-none"}
                placeholder="Información relevante sobre el cliente, acuerdos, responsables o contexto comercial."
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
        if (modal.type === "editProject") submitLabel = "Actualizar proyecto";
        content = (
          <div className="space-y-3">
            <p className={sectionLabel}>General</p>
            <div className="grid grid-cols-2 gap-3">
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
                  placeholder="midominio.com"
                  defaultValue={modal.data?.domain || ""}
                />
              </div>
            </div>
            <p className={sectionLabel}>Finanzas</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Presupuesto</label>
                <div className="grid grid-cols-[1fr_auto] gap-1.5">
                  <input
                    ref={ref("budget")}
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="50000"
                    defaultValue={modal.data?.budget && modal.data.budget !== "0" ? modal.data.budget : ""}
                    onInput={(e) => {
                      const digits = e.currentTarget.value.replace(/[^\d]/g, "");
                      const num = parseInt(digits, 10);
                      e.currentTarget.value = isNaN(num) ? "" : num.toLocaleString("es-MX");
                    }}
                  />
                  <select
                    ref={ref("budgetIva")}
                    className="w-32 bg-[#18181B] border border-zinc-800 rounded-lg px-2 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#0EA5E9] transition-colors duration-150"
                    defaultValue={modal.data?.budgetIva || "none"}
                  >
                    <option value="none">Sin IVA</option>
                    <option value="plus">+ IVA</option>
                    <option value="included">IVA incl.</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Costos anuales</label>
                <div className="grid grid-cols-[1fr_auto] gap-1.5">
                  <input
                    ref={ref("annual")}
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="6000"
                    defaultValue={modal.data?.annual && modal.data.annual !== "0" ? modal.data.annual : ""}
                    onInput={(e) => {
                      const digits = e.currentTarget.value.replace(/[^\d]/g, "");
                      const num = parseInt(digits, 10);
                      e.currentTarget.value = isNaN(num) ? "" : num.toLocaleString("es-MX");
                    }}
                  />
                  <select
                    ref={ref("annualIva")}
                    className="w-32 bg-[#18181B] border border-zinc-800 rounded-lg px-2 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#0EA5E9] transition-colors duration-150"
                    defaultValue={modal.data?.annualIva || "none"}
                  >
                    <option value="none">Sin IVA</option>
                    <option value="plus">+ IVA</option>
                    <option value="included">IVA incl.</option>
                  </select>
                </div>
              </div>
            </div>
            <p className={sectionLabel}>Recursos</p>
            <div>
              <label className={labelClass}>Tecnologías</label>
              <input
                ref={ref("tech")}
                className={inputClass}
                placeholder="React, Node.js, Firebase"
                defaultValue={modal.data?.tech || ""}
              />
              {modal.data?.tech && modal.data.tech.trim() && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {modal.data.tech
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 text-[11px] text-zinc-300 bg-zinc-800 rounded-full border border-zinc-700"
                      >
                        {t}
                      </span>
                    ))}
                </div>
              )}
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
        submitLabel = "Crear tarea";
        content = (
          <div className="space-y-3">
            {modal.data?.clientName && (
              <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-500">
                <span>
                  Cliente:{" "}
                  <span className="font-medium text-zinc-300">{modal.data.clientName}</span>
                </span>
                <span className="text-zinc-700">·</span>
                <span>
                  Proyecto:{" "}
                  <span className="font-medium text-zinc-300">{modal.data.projectName}</span>
                </span>
              </div>
            )}
            <div>
              <label className={labelClass}>Nombre *</label>
              <input
                ref={ref("name")}
                className={inputClass}
                placeholder="Configurar webhook Stripe"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleModalSubmit();
                  }
                }}
              />
            </div>
            <div>
              <label className={labelClass}>Descripción</label>
              <textarea
                ref={ref("desc")}
                className={inputClass + " h-16 resize-none"}
                placeholder="Pasos, contexto o enlaces necesarios para completar la tarea."
              />
            </div>
            <div>
              <label className={labelClass}>Prioridad</label>
              <input type="hidden" ref={ref("prio")} defaultValue="important" />
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                {(
                  [
                    { value: "urgent_important", emoji: "🔴", label: "Crítica" },
                    { value: "important", emoji: "🟠", label: "Importante" },
                    { value: "urgent", emoji: "🟡", label: "Normal" },
                    { value: "low", emoji: "🟢", label: "Baja" },
                  ] as const
                ).map(({ value, emoji, label }) => (
                  <button
                    key={value}
                    type="button"
                    data-prio-btn={value}
                    onClick={() => {
                      const el = formRefs.current["prio"] as HTMLInputElement | null;
                      if (el) el.value = value;
                      document.querySelectorAll("[data-prio-btn]").forEach((btn) => {
                        (btn as HTMLElement).style.outline = "none";
                        (btn as HTMLElement).style.background = "";
                      });
                      const target = document.querySelector(
                        `[data-prio-btn="${value}"]`,
                      ) as HTMLElement | null;
                      if (target) target.style.outline = "2px solid rgba(14,165,233,0.7)";
                    }}
                    className="flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg text-xs text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/60 transition-all"
                    style={{
                      outline: value === "important" ? "2px solid rgba(14,165,233,0.7)" : "none",
                      outlineOffset: "2px",
                    }}
                  >
                    <span className="text-base">{emoji}</span>
                    <span className="text-[10px] text-zinc-400">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
        break;
      }
      case "addKey": {
        title = "Nueva llave";
        submitLabel = "Guardar credencial";
        content = (
          <div className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-500 leading-relaxed">
              Guarda tokens, API keys, contraseñas o datos técnicos relevantes para este proyecto.
            </div>
            <div>
              <label className={labelClass}>Etiqueta</label>
              <input
                ref={ref("label")}
                className={inputClass}
                placeholder="OPENAI_API_KEY"
                autoFocus
              />
              <div className="flex gap-1.5 mt-1.5">
                {["OPENAI_API_KEY", "Token WhatsApp Cloud", "Stripe Secret Key"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      const el = formRefs.current["label"] as HTMLInputElement | null;
                      if (el) { el.value = s; el.focus(); }
                    }}
                    className="px-2 py-0.5 text-[10px] text-zinc-500 bg-zinc-800/60 hover:bg-zinc-700 rounded-md transition-colors whitespace-nowrap"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>
                Valor <span className="text-zinc-600">(dato sensible)</span>
              </label>
              <div className="relative">
                <input
                  ref={ref("value")}
                  type="password"
                  className={inputClass + " pr-10"}
                  placeholder="sk-proj-xxxx..."
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = formRefs.current["value"] as HTMLInputElement | null;
                    if (el) el.type = el.type === "password" ? "text" : "password";
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
                  title="Mostrar / ocultar"
                >
                  👁
                </button>
              </div>
            </div>
          </div>
        );
        break;
      }
      case "editReadme": {
        title = "Documentación del proyecto";
        submitLabel = "Actualizar documentación";
        const readmeTemplate = `# Descripción\n\n## Objetivo\n\n## Tecnologías\n\n## Configuración\n\n## Notas importantes`;
        content = (
          <div className="space-y-2">
            <textarea
              ref={ref("content")}
              className={inputClass + " h-80 resize-y font-mono text-xs leading-relaxed"}
              defaultValue={modal.data?.content || readmeTemplate}
              autoFocus
            />
            <div className="rounded-lg border border-white/[0.04] bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-600">
              <p className="mb-1 font-medium text-zinc-500">Soporta Markdown</p>
              <pre className="font-mono leading-relaxed whitespace-pre-wrap">{`# Títulos  ## Secciones  - Listas\n\`\`\`bash\nnpm install\n\`\`\``}</pre>
            </div>
          </div>
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
        if (modal.type === "addCharge") {
          subtitle = "Programa recordatorios automáticos para servicios recurrentes.";
          submitLabel = "Crear cobro recurrente";
        }
        const updateChargeDate = () => {
          const freqEl = formRefs.current["frequency"] as HTMLSelectElement | null;
          const dateEl = formRefs.current["startDate"] as HTMLInputElement | null;
          const span = document.getElementById("charge-next-date");
          if (!freqEl || !dateEl || !span || !dateEl.value) {
            if (span) span.textContent = "—";
            return;
          }
          const d = new Date(dateEl.value + "T12:00:00");
          if (isNaN(d.getTime())) { span.textContent = "—"; return; }
          if (freqEl.value === "monthly") d.setMonth(d.getMonth() + 1);
          else d.setFullYear(d.getFullYear() + 1);
          const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
          span.textContent = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        };
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
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {["Hosting", "Dominio", "VPS", "Mantenimiento", "Licencia", "Otro"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      const el = formRefs.current["concept"] as HTMLInputElement | null;
                      if (el) { el.value = s; el.focus(); }
                    }}
                    className="px-2 py-1 text-[11px] text-zinc-400 bg-zinc-800/60 hover:bg-zinc-700 rounded-md transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Monto (MXN) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">
                  $
                </span>
                <input
                  ref={ref("amount")}
                  type="number"
                  className={inputClass + " pl-6"}
                  placeholder="15000"
                  defaultValue={modal.data?.amount || ""}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Frecuencia *</label>
                <select
                  ref={ref("frequency")}
                  className={inputClass}
                  defaultValue={modal.data?.frequency || "annual"}
                  onChange={updateChargeDate}
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
                  onChange={updateChargeDate}
                />
              </div>
            </div>
            <div className="rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-500">
              Próximo cobro estimado:{" "}
              <span id="charge-next-date" className="font-medium text-zinc-300">
                —
              </span>
            </div>
            <div>
              <label className={labelClass}>
                Email del cliente <span className="text-zinc-600">(opcional)</span>
              </label>
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
                className={inputClass + " min-h-[300px] resize-y font-mono text-xs"}
                style={{ minHeight: "300px" }}
                placeholder="Detalle completo del tip, comandos, explicación..."
                defaultValue={modal.data?.content || ""}
              />
              <div className="mt-1.5 rounded-lg border border-white/[0.04] bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-600">
                <p className="mb-1 font-medium text-zinc-500">Soporta Markdown y bloques de código</p>
                <pre className="font-mono leading-relaxed">{`# Título\n- Lista\n\`\`\`bash\nnpm install\n\`\`\``}</pre>
              </div>
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
            {submitLabel}
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
