"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useUser } from "@/hooks/use-user";
import type { Strategy, StrategyObjective, StrategyKPI, RoadmapItem } from "@/types/documents";
import { getStrategy, createStrategy, updateStrategy } from "@/lib/documents/strategies";

interface Props {
  clientId: string;
}

const OBJ_STATUS = {
  pendiente:   { label: "Pendiente",   classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
  en_progreso: { label: "En progreso", classes: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
  completado:  { label: "Completado",  classes: "bg-green-500/15 text-green-300 border-green-500/20" },
} satisfies Record<StrategyObjective["status"], { label: string; classes: string }>;

const PRIORITY_CONFIG = {
  alta:  { label: "Alta",  classes: "bg-red-500/15 text-red-400 border-red-500/20" },
  media: { label: "Media", classes: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  baja:  { label: "Baja",  classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
} satisfies Record<RoadmapItem["priority"], { label: string; classes: string }>;

const CHANNELS = ["Web", "Social Media", "Email", "WhatsApp", "Google Ads", "SEO"] as const;

export function EstrategiaTab({ clientId }: Props) {
  const user = useUser();

  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const creatingStrategyRef = useRef<Promise<Strategy> | null>(null);

  // Objectives inline editing
  const [editingObj, setEditingObj] = useState<string | null>(null);
  const [objDraft, setObjDraft] = useState<Partial<StrategyObjective>>({});
  const [addingObj, setAddingObj] = useState(false);

  // KPIs inline editing
  const [editingKpi, setEditingKpi] = useState<string | null>(null);
  const [kpiDraft, setKpiDraft] = useState<Partial<StrategyKPI>>({});
  const [addingKpi, setAddingKpi] = useState(false);

  // Roadmap
  const [editingRoadmap, setEditingRoadmap] = useState<string | null>(null);
  const [roadmapDraft, setRoadmapDraft] = useState<Partial<RoadmapItem>>({});
  const [addingRoadmap, setAddingRoadmap] = useState(false);

  // Prioridades
  const [newPriority, setNewPriority] = useState("");

  // Canales
  const [customChannel, setCustomChannel] = useState("");

  // Automatizaciones
  const [automationsText, setAutomationsText] = useState("");
  const [autosSaving, setAutosSaving] = useState(false);

  const loadStrategy = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getStrategy(user.uid, clientId);
      setStrategy(data);
      if (data?.automations) setAutomationsText(data.automations.join("\n"));
    } finally {
      setLoading(false);
    }
  }, [user, clientId]);

  useEffect(() => { loadStrategy(); }, [loadStrategy]);

  const ensureStrategy = useCallback(async (): Promise<Strategy> => {
    if (strategy) return strategy;
    if (!user) throw new Error("Not ready");
    // Deduplicate concurrent calls — only one createStrategy runs at a time
    if (creatingStrategyRef.current) return creatingStrategyRef.current;
    const p = createStrategy(user.uid, clientId).then((id) => {
      const newStrategy: Strategy = {
        id, uid: user.uid, clientId,
        objectives: [], kpis: [], roadmap: [],
        priorities: [], channels: [], automations: [],
        lastUpdated: new Date().toISOString(),
      };
      setStrategy(newStrategy);
      creatingStrategyRef.current = null;
      return newStrategy;
    });
    creatingStrategyRef.current = p;
    return p;
  }, [strategy, user, clientId]);

  const saveStrategy = useCallback(async (updated: Strategy) => {
    setSaving(true);
    try {
      await updateStrategy(updated.id, {
        objectives: updated.objectives,
        kpis: updated.kpis,
        roadmap: updated.roadmap,
        priorities: updated.priorities,
        channels: updated.channels,
        automations: updated.automations,
      });
      setStrategy(updated);
    } finally {
      setSaving(false);
    }
  }, []);

  // ── Objectives handlers ────────────────────────────────────────────────────

  const handleAddObjective = async () => {
    if (!objDraft.title?.trim()) return;
    const s = await ensureStrategy();
    const newObj: StrategyObjective = {
      id: crypto.randomUUID(),
      title: objDraft.title.trim(),
      description: objDraft.description ?? "",
      dueDate: objDraft.dueDate,
      status: "pendiente",
    };
    const updated = { ...s, objectives: [...s.objectives, newObj] };
    await saveStrategy(updated);
    setAddingObj(false);
    setObjDraft({});
  };

  const handleUpdateObjective = async (id: string) => {
    if (!strategy) return;
    const updated = {
      ...strategy,
      objectives: strategy.objectives.map(o =>
        o.id === id ? { ...o, ...objDraft } : o
      ),
    };
    await saveStrategy(updated);
    setEditingObj(null);
    setObjDraft({});
  };

  const handleDeleteObjective = async (id: string) => {
    if (!strategy) return;
    const updated = { ...strategy, objectives: strategy.objectives.filter(o => o.id !== id) };
    await saveStrategy(updated);
  };

  // ── KPI handlers ───────────────────────────────────────────────────────────

  const handleAddKpi = async () => {
    if (!kpiDraft.name?.trim()) return;
    const s = await ensureStrategy();
    const newKpi: StrategyKPI = {
      id: crypto.randomUUID(),
      name: kpiDraft.name.trim(),
      target: kpiDraft.target ?? "",
      current: kpiDraft.current ?? "",
      unit: kpiDraft.unit ?? "",
    };
    const updated = { ...s, kpis: [...s.kpis, newKpi] };
    await saveStrategy(updated);
    setAddingKpi(false);
    setKpiDraft({});
  };

  const handleUpdateKpi = async (id: string) => {
    if (!strategy) return;
    const updated = {
      ...strategy,
      kpis: strategy.kpis.map(k =>
        k.id === id ? { ...k, ...kpiDraft } : k
      ),
    };
    await saveStrategy(updated);
    setEditingKpi(null);
    setKpiDraft({});
  };

  const handleDeleteKpi = async (id: string) => {
    if (!strategy) return;
    const updated = { ...strategy, kpis: strategy.kpis.filter(k => k.id !== id) };
    await saveStrategy(updated);
  };

  // ── Roadmap handlers ───────────────────────────────────────────────────────

  const handleAddRoadmapItem = async () => {
    if (!roadmapDraft.title?.trim()) return;
    const s = await ensureStrategy();
    const newItem: RoadmapItem = {
      id: crypto.randomUUID(),
      title: roadmapDraft.title.trim(),
      sprint: roadmapDraft.sprint ?? "",
      status: "pendiente",
      priority: roadmapDraft.priority ?? "media",
    };
    await saveStrategy({ ...s, roadmap: [...s.roadmap, newItem] });
    setAddingRoadmap(false);
    setRoadmapDraft({});
  };

  const handleUpdateRoadmapItem = async (id: string) => {
    if (!strategy) return;
    const updated = {
      ...strategy,
      roadmap: strategy.roadmap.map(r =>
        r.id === id ? { ...r, ...roadmapDraft } : r
      ),
    };
    await saveStrategy(updated);
    setEditingRoadmap(null);
    setRoadmapDraft({});
  };

  const handleDeleteRoadmapItem = async (id: string) => {
    if (!strategy) return;
    const updated = { ...strategy, roadmap: strategy.roadmap.filter(r => r.id !== id) };
    await saveStrategy(updated);
  };

  const handleMoveRoadmap = async (id: string, dir: "up" | "down") => {
    if (!strategy) return;
    const items = [...strategy.roadmap];
    const idx = items.findIndex(r => r.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === items.length - 1) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
    await saveStrategy({ ...strategy, roadmap: items });
  };

  // ── Prioridades handlers ───────────────────────────────────────────────────

  const handleAddPriority = async () => {
    if (!newPriority.trim()) return;
    const s = await ensureStrategy();
    await saveStrategy({ ...s, priorities: [...s.priorities, newPriority.trim()] });
    setNewPriority("");
  };

  const handleDeletePriority = async (idx: number) => {
    if (!strategy) return;
    const updated = strategy.priorities.filter((_, i) => i !== idx);
    await saveStrategy({ ...strategy, priorities: updated });
  };

  const handleMovePriority = async (idx: number, dir: "up" | "down") => {
    if (!strategy) return;
    const items = [...strategy.priorities];
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === items.length - 1) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
    await saveStrategy({ ...strategy, priorities: items });
  };

  // ── Canales handlers ───────────────────────────────────────────────────────

  const handleToggleChannel = async (channel: string) => {
    const s = await ensureStrategy();
    const current = s.channels;
    const updated = current.includes(channel)
      ? current.filter(c => c !== channel)
      : [...current, channel];
    await saveStrategy({ ...s, channels: updated });
  };

  const handleAddCustomChannel = async () => {
    if (!customChannel.trim()) return;
    const s = await ensureStrategy();
    if (s.channels.includes(customChannel.trim())) return;
    await saveStrategy({ ...s, channels: [...s.channels, customChannel.trim()] });
    setCustomChannel("");
  };

  const handleRemoveCustomChannel = async (channel: string) => {
    if (!strategy) return;
    await saveStrategy({ ...strategy, channels: strategy.channels.filter(c => c !== channel) });
  };

  // ── Automatizaciones handler ───────────────────────────────────────────────

  const handleSaveAutomations = async () => {
    const s = await ensureStrategy();
    setAutosSaving(true);
    try {
      const lines = automationsText.split("\n").filter(l => l.trim());
      await saveStrategy({ ...s, automations: lines });
    } finally {
      setAutosSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" className="text-cyan-400" />
        </div>
      )}

      {!loading && (
        <>
          {/* ── Objetivos ─────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
                Objetivos
              </h3>
              {saving && (
                <span className="text-xs text-zinc-500 animate-pulse">Guardando…</span>
              )}
            </div>

            <div className="space-y-2">
              {(strategy?.objectives ?? []).map((obj) => (
                <div key={obj.id}>
                  {editingObj === obj.id ? (
                    /* Edit form */
                    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-3 space-y-2">
                      <input
                        type="text"
                        value={objDraft.title ?? obj.title}
                        onChange={e => setObjDraft(d => ({ ...d, title: e.target.value }))}
                        placeholder="Título del objetivo"
                        className="w-full rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                      />
                      <input
                        type="text"
                        value={objDraft.description ?? obj.description}
                        onChange={e => setObjDraft(d => ({ ...d, description: e.target.value }))}
                        placeholder="Descripción"
                        className="w-full rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                      />
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={objDraft.dueDate ?? obj.dueDate ?? ""}
                          onChange={e => setObjDraft(d => ({ ...d, dueDate: e.target.value || undefined }))}
                          className="flex-1 rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                        <select
                          value={objDraft.status ?? obj.status}
                          onChange={e => setObjDraft(d => ({ ...d, status: e.target.value as StrategyObjective["status"] }))}
                          className="flex-1 rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="en_progreso">En progreso</option>
                          <option value="completado">Completado</option>
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => { setEditingObj(null); setObjDraft({}); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateObjective(obj.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/20 transition-colors disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display row */
                    <div className="flex items-start gap-3 rounded-lg border border-zinc-700/30 bg-zinc-800/20 px-3 py-2.5 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-zinc-200 truncate">{obj.title}</span>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${OBJ_STATUS[obj.status].classes}`}>
                            {OBJ_STATUS[obj.status].label}
                          </span>
                        </div>
                        {obj.description && (
                          <p className="text-xs text-zinc-500 mt-0.5 truncate">{obj.description}</p>
                        )}
                        {obj.dueDate && (
                          <p className="text-xs text-zinc-600 mt-0.5">Fecha límite: {obj.dueDate}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingObj(obj.id);
                            setObjDraft({ title: obj.title, description: obj.description, dueDate: obj.dueDate, status: obj.status });
                          }}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
                          aria-label="Editar objetivo"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteObjective(obj.id)}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label="Eliminar objetivo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add form */}
              {addingObj ? (
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-3 space-y-2">
                  <input
                    type="text"
                    value={objDraft.title ?? ""}
                    onChange={e => setObjDraft(d => ({ ...d, title: e.target.value }))}
                    placeholder="Título del objetivo"
                    autoFocus
                    className="w-full rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                  <input
                    type="text"
                    value={objDraft.description ?? ""}
                    onChange={e => setObjDraft(d => ({ ...d, description: e.target.value }))}
                    placeholder="Descripción"
                    className="w-full rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                  <input
                    type="date"
                    value={objDraft.dueDate ?? ""}
                    onChange={e => setObjDraft(d => ({ ...d, dueDate: e.target.value || undefined }))}
                    className="w-full rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setAddingObj(false); setObjDraft({}); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddObjective}
                      disabled={saving || !objDraft.title?.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/20 transition-colors disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Agregar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAddingObj(true); setObjDraft({}); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 border border-dashed border-zinc-700/50 hover:border-zinc-600/50 transition-colors w-full"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar objetivo
                </button>
              )}
            </div>
          </section>

          {/* ── KPIs ──────────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">
              KPIs
            </h3>

            <div className="space-y-1">
              {/* Table header */}
              {(strategy?.kpis ?? []).length > 0 && (
                <div className="grid grid-cols-4 gap-2 px-3 py-1.5 text-[10px] font-medium text-zinc-600 uppercase tracking-wide">
                  <span>Nombre</span>
                  <span>Objetivo</span>
                  <span>Actual</span>
                  <span>Unidad</span>
                </div>
              )}

              {(strategy?.kpis ?? []).map((kpi) => (
                <div key={kpi.id}>
                  {editingKpi === kpi.id ? (
                    /* Edit form */
                    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={kpiDraft.name ?? kpi.name}
                          onChange={e => setKpiDraft(d => ({ ...d, name: e.target.value }))}
                          placeholder="Nombre"
                          className="rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                        <input
                          type="text"
                          value={kpiDraft.unit ?? kpi.unit}
                          onChange={e => setKpiDraft(d => ({ ...d, unit: e.target.value }))}
                          placeholder="Unidad (%, MXN, …)"
                          className="rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                        <input
                          type="text"
                          value={kpiDraft.target ?? kpi.target}
                          onChange={e => setKpiDraft(d => ({ ...d, target: e.target.value }))}
                          placeholder="Objetivo"
                          className="rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                        <input
                          type="text"
                          value={kpiDraft.current ?? kpi.current}
                          onChange={e => setKpiDraft(d => ({ ...d, current: e.target.value }))}
                          placeholder="Actual"
                          className="rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => { setEditingKpi(null); setKpiDraft({}); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateKpi(kpi.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/20 transition-colors disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display row */
                    <div className="grid grid-cols-4 gap-2 items-center rounded-lg border border-zinc-700/30 bg-zinc-800/20 px-3 py-2 group">
                      <span className="text-sm text-zinc-200 truncate">{kpi.name}</span>
                      <span className="text-sm text-zinc-400 truncate">{kpi.target || "—"}</span>
                      <span className="text-sm text-zinc-400 truncate">{kpi.current || "—"}</span>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm text-zinc-500 truncate">{kpi.unit || "—"}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingKpi(kpi.id);
                              setKpiDraft({ name: kpi.name, target: kpi.target, current: kpi.current, unit: kpi.unit });
                            }}
                            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
                            aria-label="Editar KPI"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKpi(kpi.id)}
                            className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            aria-label="Eliminar KPI"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add form */}
              {addingKpi ? (
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={kpiDraft.name ?? ""}
                      onChange={e => setKpiDraft(d => ({ ...d, name: e.target.value }))}
                      placeholder="Nombre del KPI"
                      autoFocus
                      className="rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    />
                    <input
                      type="text"
                      value={kpiDraft.unit ?? ""}
                      onChange={e => setKpiDraft(d => ({ ...d, unit: e.target.value }))}
                      placeholder="Unidad (%, MXN, …)"
                      className="rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    />
                    <input
                      type="text"
                      value={kpiDraft.target ?? ""}
                      onChange={e => setKpiDraft(d => ({ ...d, target: e.target.value }))}
                      placeholder="Valor objetivo"
                      className="rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    />
                    <input
                      type="text"
                      value={kpiDraft.current ?? ""}
                      onChange={e => setKpiDraft(d => ({ ...d, current: e.target.value }))}
                      placeholder="Valor actual"
                      className="rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setAddingKpi(false); setKpiDraft({}); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddKpi}
                      disabled={saving || !kpiDraft.name?.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/20 transition-colors disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Agregar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAddingKpi(true); setKpiDraft({}); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 border border-dashed border-zinc-700/50 hover:border-zinc-600/50 transition-colors w-full"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar KPI
                </button>
              )}
            </div>
          </section>

          {/* ── Roadmap ───────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">
              Roadmap
            </h3>

            <div className="space-y-2">
              {(strategy?.roadmap ?? []).map((item, idx) => (
                <div key={item.id}>
                  {editingRoadmap === item.id ? (
                    /* Edit form */
                    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-3 space-y-2">
                      <input
                        type="text"
                        value={roadmapDraft.title ?? item.title}
                        onChange={e => setRoadmapDraft(d => ({ ...d, title: e.target.value }))}
                        placeholder="Título"
                        className="w-full rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={roadmapDraft.sprint ?? item.sprint}
                          onChange={e => setRoadmapDraft(d => ({ ...d, sprint: e.target.value }))}
                          placeholder="Sprint 1"
                          className="flex-1 rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                        <select
                          value={roadmapDraft.priority ?? item.priority}
                          onChange={e => setRoadmapDraft(d => ({ ...d, priority: e.target.value as RoadmapItem["priority"] }))}
                          className="flex-1 rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        >
                          <option value="alta">Alta</option>
                          <option value="media">Media</option>
                          <option value="baja">Baja</option>
                        </select>
                        <select
                          value={roadmapDraft.status ?? item.status}
                          onChange={e => setRoadmapDraft(d => ({ ...d, status: e.target.value as RoadmapItem["status"] }))}
                          className="flex-1 rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="en_progreso">En progreso</option>
                          <option value="completado">Completado</option>
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => { setEditingRoadmap(null); setRoadmapDraft({}); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateRoadmapItem(item.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/20 transition-colors disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display row */
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-700/30 bg-zinc-800/20 px-3 py-2.5 group">
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveRoadmap(item.id, "up")}
                          disabled={idx === 0 || saving}
                          className="p-0.5 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors"
                          aria-label="Mover arriba"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveRoadmap(item.id, "down")}
                          disabled={idx === (strategy?.roadmap.length ?? 0) - 1 || saving}
                          className="p-0.5 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors"
                          aria-label="Mover abajo"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-zinc-200 truncate">{item.title}</span>
                          {item.sprint && (
                            <span className="inline-flex items-center rounded-full border border-zinc-600/30 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                              {item.sprint}
                            </span>
                          )}
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${PRIORITY_CONFIG[item.priority].classes}`}>
                            {PRIORITY_CONFIG[item.priority].label}
                          </span>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${OBJ_STATUS[item.status].classes}`}>
                            {OBJ_STATUS[item.status].label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRoadmap(item.id);
                            setRoadmapDraft({ title: item.title, sprint: item.sprint, priority: item.priority, status: item.status });
                          }}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
                          aria-label="Editar item"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRoadmapItem(item.id)}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label="Eliminar item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add form */}
              {addingRoadmap ? (
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-3 space-y-2">
                  <input
                    type="text"
                    value={roadmapDraft.title ?? ""}
                    onChange={e => setRoadmapDraft(d => ({ ...d, title: e.target.value }))}
                    placeholder="Título"
                    autoFocus
                    className="w-full rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={roadmapDraft.sprint ?? ""}
                      onChange={e => setRoadmapDraft(d => ({ ...d, sprint: e.target.value }))}
                      placeholder="Sprint 1"
                      className="flex-1 rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    />
                    <select
                      value={roadmapDraft.priority ?? "media"}
                      onChange={e => setRoadmapDraft(d => ({ ...d, priority: e.target.value as RoadmapItem["priority"] }))}
                      className="flex-1 rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    >
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setAddingRoadmap(false); setRoadmapDraft({}); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddRoadmapItem}
                      disabled={saving || !roadmapDraft.title?.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/20 transition-colors disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Agregar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAddingRoadmap(true); setRoadmapDraft({}); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 border border-dashed border-zinc-700/50 hover:border-zinc-600/50 transition-colors w-full"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar item al roadmap
                </button>
              )}
            </div>
          </section>

          {/* ── Prioridades ───────────────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">
              Prioridades
            </h3>

            <div className="space-y-1">
              {(strategy?.priorities ?? []).map((priority, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg border border-zinc-700/30 bg-zinc-800/20 px-3 py-2 group"
                >
                  <span className="text-xs font-medium text-zinc-600 w-5 flex-shrink-0">{idx + 1}.</span>
                  <span className="flex-1 text-sm text-zinc-200">{priority}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMovePriority(idx, "up")}
                      disabled={idx === 0 || saving}
                      className="p-1 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors"
                      aria-label="Mover arriba"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMovePriority(idx, "down")}
                      disabled={idx === (strategy?.priorities.length ?? 0) - 1 || saving}
                      className="p-1 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors"
                      aria-label="Mover abajo"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePriority(idx)}
                      className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      aria-label="Eliminar prioridad"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddPriority(); }}
                  placeholder="Nueva prioridad…"
                  className="flex-1 rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                />
                <button
                  type="button"
                  onClick={handleAddPriority}
                  disabled={saving || !newPriority.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/20 transition-colors disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              </div>
            </div>
          </section>

          {/* ── Canales y automatizaciones ────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">
              Canales y automatizaciones
            </h3>

            {/* Channel checkboxes */}
            <div className="mb-4">
              <p className="text-xs text-zinc-500 mb-2">Canales activos</p>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map(ch => {
                  const active = strategy?.channels.includes(ch) ?? false;
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => handleToggleChannel(ch)}
                      disabled={saving}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors disabled:opacity-50 ${
                        active
                          ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/25"
                          : "bg-zinc-800/40 text-zinc-500 border-zinc-700/50 hover:text-zinc-300 hover:border-zinc-600/50"
                      }`}
                    >
                      {active && <Check className="h-3 w-3" />}
                      {ch}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom channels */}
            {(() => {
              const customChannels = (strategy?.channels ?? []).filter(
                c => !(CHANNELS as readonly string[]).includes(c)
              );
              return customChannels.length > 0 ? (
                <div className="mb-4">
                  <p className="text-xs text-zinc-500 mb-2">Canales personalizados</p>
                  <div className="flex flex-wrap gap-2">
                    {customChannels.map(ch => (
                      <span
                        key={ch}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-zinc-700/20 text-zinc-300 border-zinc-600/30 text-xs font-medium"
                      >
                        {ch}
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomChannel(ch)}
                          disabled={saving}
                          className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
                          aria-label={`Eliminar canal ${ch}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Add custom channel */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={customChannel}
                onChange={e => setCustomChannel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddCustomChannel(); }}
                placeholder="Canal personalizado…"
                className="flex-1 rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
              <button
                type="button"
                onClick={handleAddCustomChannel}
                disabled={saving || !customChannel.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-zinc-700/40 text-zinc-300 hover:bg-zinc-700/60 border border-zinc-600/30 transition-colors disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </button>
            </div>

            {/* Automatizaciones textarea */}
            <div>
              <p className="text-xs text-zinc-500 mb-2">Automatizaciones</p>
              <textarea
                value={automationsText}
                onChange={e => setAutomationsText(e.target.value)}
                rows={5}
                placeholder="Describe las automatizaciones activas o planificadas…"
                className="w-full rounded-md bg-zinc-900/60 border border-zinc-700/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-y"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={handleSaveAutomations}
                  disabled={autosSaving || saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/20 transition-colors disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {autosSaving ? "Guardando…" : "Guardar automatizaciones"}
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
