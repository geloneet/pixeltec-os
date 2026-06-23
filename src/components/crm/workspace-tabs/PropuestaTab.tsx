"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import type { Proposal } from "@/types/documents";
import { getProposals, createProposal, updateProposal } from "@/lib/documents/proposals";

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  borrador:  { label: "Borrador",  classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
  enviada:   { label: "Enviada",   classes: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
  aceptada:  { label: "Aceptada", classes: "bg-green-500/15 text-green-300 border-green-500/20" },
  rechazada: { label: "Rechazada", classes: "bg-red-500/15 text-red-400 border-red-500/20" },
  vencida:   { label: "Vencida",  classes: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
} satisfies Record<Proposal["status"], { label: string; classes: string }>;

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  clientName: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PropuestaTab({ clientId, clientName }: Props) {
  const firestore = useFirestore();
  const user = useUser();

  // View state
  const [view, setView] = useState<"list" | "create" | "detail">("list");

  // Data
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);

  // Create form
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<{
    solution: string;
    deliverables: string;
    benefits: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Detail
  const [converting, setConverting] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadProposals = useCallback(async () => {
    if (!firestore || !user) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getProposals(firestore, user.uid, clientId);
      setProposals(data);
    } finally {
      setLoading(false);
    }
  }, [firestore, user, clientId]);

  useEffect(() => { loadProposals(); }, [loadProposals]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!scope.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/documents/proposal-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, scope, budget, timeline }),
      });
      const data = await res.json();
      setGeneratedData(data);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !scope.trim() || !firestore || !user) return;
    setSaving(true);
    try {
      await createProposal(firestore, user.uid, clientId, {
        title: title.trim(),
        scope: scope.trim(),
        solution: generatedData?.solution,
        deliverables: generatedData?.deliverables,
        benefits: generatedData?.benefits,
        budget: budget.trim() || undefined,
        timeline: timeline.trim() || undefined,
        status: "borrador",
      });
      setView("list");
      setTitle(""); setScope(""); setBudget(""); setTimeline("");
      setGeneratedData(null);
      await loadProposals();
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToContract = async () => {
    if (!firestore || !user || !selected) return;
    setConverting(true);
    try {
      const { createContract } = await import("@/lib/documents/contracts");
      const content = [
        selected.scope && `ALCANCE:\n${selected.scope}`,
        selected.solution && `\nSOLUCIÓN PROPUESTA:\n${selected.solution}`,
        selected.deliverables && `\nENTREGABLES:\n${selected.deliverables}`,
        selected.benefits && `\nBENEFICIOS:\n${selected.benefits}`,
        selected.budget && `\nPRESUPUESTO: ${selected.budget}`,
        selected.timeline && `\nTIMELINE: ${selected.timeline}`,
      ].filter(Boolean).join("\n");

      const newContractId = await createContract(firestore, user.uid, clientId, {
        title: selected.title,
        content,
        status: "borrador",
        signers: [],
        variables: {},
        proposalId: selected.id,
      });
      // Mark proposal as aceptada and record the contractId
      await updateProposal(firestore, selected.id, { status: "aceptada", contractId: newContractId });
      setSelected(prev => prev ? { ...prev, status: "aceptada", contractId: newContractId } : prev);
      await loadProposals();
    } finally {
      setConverting(false);
    }
  };

  const handleStatusChange = async (newStatus: Proposal["status"]) => {
    if (!firestore || !selected) return;
    await updateProposal(firestore, selected.id, { status: newStatus });
    setSelected(prev => prev ? { ...prev, status: newStatus } : prev);
    await loadProposals();
  };

  // ── LIST view ─────────────────────────────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Propuestas</h3>
          <button
            onClick={() => setView("create")}
            className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
          >
            + Nueva propuesta
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="text-xs text-zinc-500">Cargando...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && proposals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-3 h-8 w-8 text-zinc-600" />
            <p className="mb-3 text-sm font-medium text-zinc-400">Sin propuestas</p>
            <button
              onClick={() => setView("create")}
              className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
            >
              Crear primera propuesta
            </button>
          </div>
        )}

        {/* Proposal rows */}
        {proposals.map((proposal) => (
          <button
            key={proposal.id}
            onClick={() => { setSelected(proposal); setView("detail"); }}
            className="w-full text-left rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 hover:border-white/[0.10] transition-all"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-zinc-200 truncate">{proposal.title}</span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${STATUS_CONFIG[proposal.status].classes}`}>
                {STATUS_CONFIG[proposal.status].label}
              </span>
            </div>
            <div className="text-xs text-zinc-500">
              {new Date(proposal.createdAt).toLocaleDateString("es-MX")}
            </div>
          </button>
        ))}
      </div>
    );
  }

  // ── CREATE view ───────────────────────────────────────────────────────────────

  if (view === "create") {
    return (
      <div className="space-y-4">
        {/* Back */}
        <button
          onClick={() => setView("list")}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </button>
        <h3 className="text-sm font-semibold text-zinc-300">Nueva propuesta</h3>

        {/* Title */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Propuesta de desarrollo web"
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
          />
        </div>

        {/* Scope */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            Alcance <span className="text-zinc-600">(qué necesita el cliente)</span>
          </label>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="Describe el proyecto y las necesidades del cliente..."
            rows={3}
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 resize-none"
          />
        </div>

        {/* Budget + Timeline */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Presupuesto <span className="text-zinc-600">(opcional)</span>
            </label>
            <input
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Ej: $50,000 MXN"
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Timeline <span className="text-zinc-600">(opcional)</span>
            </label>
            <input
              type="text"
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              placeholder="Ej: 6 semanas"
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!scope.trim() || generating}
          className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-xs font-medium text-purple-300 transition-all hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {generating ? "Generando..." : "Generar con IA"}
        </button>

        {/* Generated fields */}
        {generatedData && (
          <div className="space-y-3 rounded-xl border border-purple-500/10 bg-purple-500/5 p-4">
            <p className="text-xs font-medium text-purple-300">Contenido generado — puedes editar antes de guardar</p>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Solución propuesta</label>
              <textarea
                value={generatedData.solution}
                onChange={(e) => setGeneratedData(prev => prev ? { ...prev, solution: e.target.value } : prev)}
                rows={3}
                className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 resize-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Entregables</label>
              <textarea
                value={generatedData.deliverables}
                onChange={(e) => setGeneratedData(prev => prev ? { ...prev, deliverables: e.target.value } : prev)}
                rows={4}
                className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 resize-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Beneficios</label>
              <textarea
                value={generatedData.benefits}
                onChange={(e) => setGeneratedData(prev => prev ? { ...prev, benefits: e.target.value } : prev)}
                rows={3}
                className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 resize-none"
              />
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!title.trim() || !scope.trim() || saving}
            className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando..." : "Guardar propuesta"}
          </button>
          <button
            onClick={() => setView("list")}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ── DETAIL view ───────────────────────────────────────────────────────────────

  if (view === "detail" && selected) {
    return (
      <div className="space-y-4">
        {/* Back */}
        <button
          onClick={() => { setSelected(null); setView("list"); }}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </button>

        {/* Title + status */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-200">{selected.title}</h3>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${STATUS_CONFIG[selected.status].classes}`}>
            {STATUS_CONFIG[selected.status].label}
          </span>
        </div>

        {/* Scope */}
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
          <p className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Alcance</p>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{selected.scope}</p>
        </div>

        {/* Solution */}
        {selected.solution && (
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
            <p className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Solución propuesta</p>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{selected.solution}</p>
          </div>
        )}

        {/* Deliverables */}
        {selected.deliverables && (
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
            <p className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Entregables</p>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{selected.deliverables}</p>
          </div>
        )}

        {/* Benefits */}
        {selected.benefits && (
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
            <p className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Beneficios</p>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{selected.benefits}</p>
          </div>
        )}

        {/* Budget / Timeline */}
        {(selected.budget || selected.timeline) && (
          <div className="flex gap-3">
            {selected.budget && (
              <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-3 flex-1">
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-0.5">Presupuesto</p>
                <p className="text-sm text-zinc-300">{selected.budget}</p>
              </div>
            )}
            {selected.timeline && (
              <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-3 flex-1">
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-0.5">Timeline</p>
                <p className="text-sm text-zinc-300">{selected.timeline}</p>
              </div>
            )}
          </div>
        )}

        {/* Status dropdown */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Cambiar estado</label>
          <select
            value={selected.status}
            onChange={(e) => handleStatusChange(e.target.value as Proposal["status"])}
            className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
          >
            {(Object.keys(STATUS_CONFIG) as Proposal["status"][]).map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>

        {/* Convert to contract */}
        <div className="pt-1">
          {selected.status === "aceptada" || selected.contractId ? (
            <span className="inline-flex items-center rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-2 text-xs font-medium text-green-400">
              Convertido a contrato
            </span>
          ) : (
            <button
              onClick={handleConvertToContract}
              disabled={converting}
              className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300 transition-all hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {converting ? "Convirtiendo..." : "Convertir a contrato"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
