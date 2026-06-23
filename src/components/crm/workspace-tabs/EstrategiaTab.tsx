"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import type { Strategy, StrategyObjective, StrategyKPI } from "@/types/documents";
import { getStrategy, createStrategy, updateStrategy } from "@/lib/documents/strategies";

interface Props {
  clientId: string;
}

const OBJ_STATUS = {
  pendiente:   { label: "Pendiente",   classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
  en_progreso: { label: "En progreso", classes: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
  completado:  { label: "Completado",  classes: "bg-green-500/15 text-green-300 border-green-500/20" },
} satisfies Record<StrategyObjective["status"], { label: string; classes: string }>;

export function EstrategiaTab({ clientId }: Props) {
  const firestore = useFirestore();
  const user = useUser();

  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Objectives inline editing
  const [editingObj, setEditingObj] = useState<string | null>(null);
  const [objDraft, setObjDraft] = useState<Partial<StrategyObjective>>({});
  const [addingObj, setAddingObj] = useState(false);

  // KPIs inline editing
  const [editingKpi, setEditingKpi] = useState<string | null>(null);
  const [kpiDraft, setKpiDraft] = useState<Partial<StrategyKPI>>({});
  const [addingKpi, setAddingKpi] = useState(false);

  const loadStrategy = useCallback(async () => {
    if (!firestore || !user) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getStrategy(firestore, user.uid, clientId);
      setStrategy(data);
    } finally {
      setLoading(false);
    }
  }, [firestore, user, clientId]);

  useEffect(() => { loadStrategy(); }, [loadStrategy]);

  const ensureStrategy = useCallback(async (): Promise<Strategy> => {
    if (strategy) return strategy;
    if (!firestore || !user) throw new Error("Not ready");
    const id = await createStrategy(firestore, user.uid, clientId);
    const newStrategy: Strategy = {
      id, uid: user.uid, clientId,
      objectives: [], kpis: [], roadmap: [],
      priorities: [], channels: [], automations: [],
      lastUpdated: new Date().toISOString(),
    };
    setStrategy(newStrategy);
    return newStrategy;
  }, [strategy, firestore, user, clientId]);

  const saveStrategy = useCallback(async (updated: Strategy) => {
    if (!firestore) return;
    setSaving(true);
    try {
      await updateStrategy(firestore, updated.id, {
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
  }, [firestore]);

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400" />
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
        </>
      )}
    </div>
  );
}
