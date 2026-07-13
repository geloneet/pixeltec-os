"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, FileText, Sparkles, Link2, MessageCircle, Mail,
  Download, Eye, Clock, CheckCircle2, XCircle, Send, RefreshCw,
  ChevronDown, ChevronUp, Copy, Check, Pencil, Printer, Plus, Trash2,
} from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { KnowledgeMarkdown } from "@/components/crm/KnowledgeMarkdown";
import {
  BILLING_FREQUENCY_LABELS,
  type Proposal,
  type BillingFrequency,
  type BillingItemDraft,
} from "@/types/documents";
import { getProposals, createProposal, updateProposal, publishProposal, sendProposalEmail } from "@/lib/documents/proposals";

const PRICE_FREQUENCIES: BillingFrequency[] = ["unico", "mensual", "trimestral", "semestral", "anual"];

interface PriceLine extends BillingItemDraft {
  key: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newPriceLine(): PriceLine {
  return { key: crypto.randomUUID(), concept: "", amount: 0, frequency: "unico", dueDate: today() };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://pixeltec.mx";

function proposalUrl(token: string) {
  return `${BASE_URL}/p/${token}`;
}

function whatsappText(proposal: Proposal) {
  return `Hola ${proposal.clientName} 👋\n\nYa quedó lista la propuesta para *${proposal.title}*.\n\nPuedes verla aquí:\n${proposalUrl(proposal.publicToken!)}\n\nSi prefieres, también puedes descargar el PDF desde esa misma página.\n\nQuedo atento a cualquier comentario.`;
}

function emailText(proposal: Proposal) {
  return `Hola ${proposal.clientName},\n\nAdjunto encontrarás la propuesta para el proyecto "${proposal.title}".\n\nTambién puedes consultarla en línea:\n${proposalUrl(proposal.publicToken!)}\n\nQuedo atento a cualquier comentario o ajuste.\n\nSaludos,\nPixelTEC`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX");
}

/** Prints the proposal PDF via a hidden iframe — no new tab, no extra viewer chrome. */
function printProposalPdf(proposalId: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = `/api/documents/proposal-pdf?proposalId=${proposalId}`;
  iframe.onload = () => {
    const win = iframe.contentWindow;
    win?.focus();
    win?.print();
    win?.addEventListener("afterprint", () => {
      document.body.removeChild(iframe);
    });
  };
  document.body.appendChild(iframe);
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  borrador:  { label: "Borrador",   classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
  enviada:   { label: "Enviada",    classes: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
  vista:     { label: "Vista",      classes: "bg-purple-500/15 text-purple-300 border-purple-500/20" },
  aceptada:  { label: "Aceptada",   classes: "bg-green-500/15 text-green-300 border-green-500/20" },
  rechazada: { label: "Rechazada",  classes: "bg-red-500/15 text-red-400 border-red-500/20" },
  vencida:   { label: "Vencida",    classes: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
} satisfies Record<Proposal["status"], { label: string; classes: string }>;

const TIMELINE_STEPS = [
  { key: "creada",    label: "Creada",   field: "createdAt" as const },
  { key: "enviada",   label: "Publicada", field: "sentAt" as const },
  { key: "vista",     label: "Vista",    field: "viewedAt" as const },
  { key: "decidida",  label: "Aceptada", field: "acceptedAt" as const },
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  clientName: string;
  clientEmail: string;
  /** Dispara la navegación a Contratos con el wizard prellenado desde esta propuesta. */
  onConvertToContract?: (proposalId: string) => void;
}

// ── CopyButton helper ─────────────────────────────────────────────────────────

function CopyButton({ text, children }: { text: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={handle}
      className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-all"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : children}
    </button>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PropuestaTab({ clientId, clientName, clientEmail, onConvertToContract }: Props) {
  const user = useUser();

  const [view, setView] = useState<"list" | "create" | "edit" | "detail">("list");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);

  // Create/edit form (shared — the two views are mutually exclusive)
  const [title, setTitle]     = useState("");
  const [scope, setScope]     = useState("");
  const [budget, setBudget]   = useState("");
  const [timeline, setTimeline] = useState("");
  const [showPricing, setShowPricing] = useState(false);
  const [priceLines, setPriceLines] = useState<PriceLine[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<{ solution: string; deliverables: string; benefits: string } | null>(null);
  const [saving, setSaving]   = useState(false);

  // Detail actions
  const [publishing, setPublishing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────

  const loadProposals = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getProposals(user.uid, clientId);
      setProposals(data);
    } finally {
      setLoading(false);
    }
  }, [user, clientId]);

  useEffect(() => { loadProposals(); }, [loadProposals]);

  // ── Handlers: create ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!scope.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/documents/proposal-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, scope, budget, timeline }),
      });
      const data = await res.json() as { solution: string; deliverables: string; benefits: string };
      setGeneratedData(data);
    } finally {
      setGenerating(false);
    }
  };

  const resetForm = () => {
    setTitle(""); setScope(""); setBudget(""); setTimeline("");
    setGeneratedData(null);
    setShowPricing(false); setPriceLines([]);
  };

  const addPriceLine = () => setPriceLines(prev => [...prev, newPriceLine()]);
  const updatePriceLine = (key: string, patch: Partial<PriceLine>) =>
    setPriceLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  const removePriceLine = (key: string) => setPriceLines(prev => prev.filter(l => l.key !== key));

  const cleanPriceLines = (): BillingItemDraft[] =>
    priceLines
      .filter(l => l.concept.trim() && l.amount > 0)
      .map(({ key: _key, ...rest }) => rest);

  const handleSave = async () => {
    if (!title.trim() || !scope.trim() || !user) return;
    setSaving(true);
    try {
      const newId = await createProposal(user.uid, clientId, clientName, {
        title: title.trim(),
        scope: scope.trim(),
        solution: generatedData?.solution,
        deliverables: generatedData?.deliverables,
        benefits: generatedData?.benefits,
        budget: budget.trim() || undefined,
        timeline: timeline.trim() || undefined,
        billingItemDrafts: cleanPriceLines(),
        status: "borrador",
      });
      const data = await getProposals(user.uid, clientId);
      setProposals(data);
      resetForm();
      const created = data.find(p => p.id === newId) ?? null;
      if (created) {
        setSelected(created);
        setView("detail");
      } else {
        setView("list");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Handlers: edit ───────────────────────────────────────────────────────

  const handleOpenEdit = () => {
    if (!selected) return;
    setTitle(selected.title);
    setScope(selected.scope);
    setBudget(selected.budget ?? "");
    setTimeline(selected.timeline ?? "");
    setGeneratedData({
      solution: selected.solution ?? "",
      deliverables: selected.deliverables ?? "",
      benefits: selected.benefits ?? "",
    });
    const existingLines = (selected.billingItemDrafts ?? []).map(l => ({ ...l, key: crypto.randomUUID() }));
    setPriceLines(existingLines);
    setShowPricing(existingLines.length > 0);
    setView("edit");
  };

  const handleCancelEdit = () => {
    resetForm();
    setView("detail");
  };

  const handleSaveEdit = async () => {
    if (!selected || !title.trim() || !scope.trim()) return;
    setSaving(true);
    try {
      const patch = {
        title: title.trim(),
        scope: scope.trim(),
        solution: generatedData?.solution || undefined,
        deliverables: generatedData?.deliverables || undefined,
        benefits: generatedData?.benefits || undefined,
        budget: budget.trim() || undefined,
        timeline: timeline.trim() || undefined,
        billingItemDrafts: cleanPriceLines(),
      };
      await updateProposal(selected.id, patch);
      setSelected(prev => prev ? { ...prev, ...patch } : prev);
      resetForm();
      setView("detail");
      await loadProposals();
    } finally {
      setSaving(false);
    }
  };

  // ── Handlers: detail actions ─────────────────────────────────────────────

  const handlePublish = async () => {
    if (!selected) return;
    setPublishing(true);
    try {
      const token = await publishProposal(selected);
      const updated = { ...selected, publicToken: token, status: selected.status === "borrador" ? "enviada" as const : selected.status };
      setSelected(updated);
      await loadProposals();
    } finally {
      setPublishing(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selected || !clientEmail || !user) return;
    setSendingEmail(true);
    try {
      await sendProposalEmail(selected.id, clientEmail);
      const data = await getProposals(user.uid, clientId);
      setProposals(data);
      const refreshed = data.find(p => p.id === selected.id);
      if (refreshed) setSelected(refreshed);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 2500);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleStatusChange = async (newStatus: Proposal["status"]) => {
    if (!selected) return;
    await updateProposal(selected.id, { status: newStatus });
    setSelected(prev => prev ? { ...prev, status: newStatus } : prev);
    await loadProposals();
  };

  // ── LIST ─────────────────────────────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Propuestas</h3>
          <button
            onClick={() => setView("create")}
            className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
          >
            + Nueva propuesta
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="text-xs text-zinc-500">Cargando...</span>
          </div>
        )}

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

        {proposals.map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelected(p); setView("detail"); }}
            className="w-full text-left rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 hover:border-white/[0.10] transition-all"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-zinc-200 truncate">{p.title}</span>
                {p.reference && (
                  <span className="text-[10px] font-mono text-zinc-600 flex-shrink-0">{p.reference}</span>
                )}
              </div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${STATUS_CONFIG[p.status].classes}`}>
                {STATUS_CONFIG[p.status].label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-600">
              <span>{formatDate(p.createdAt)}</span>
              {p.publicToken && (
                <span className="flex items-center gap-1 text-purple-400/70">
                  <Eye className="h-3 w-3" /> {p.viewCount ?? 0} {(p.viewCount ?? 0) === 1 ? "vista" : "vistas"}
                </span>
              )}
              {p.currentVersion && p.currentVersion > 1 && (
                <span className="text-zinc-700">v{p.currentVersion}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  }

  // ── CREATE / EDIT (shared form) ──────────────────────────────────────────

  if (view === "create" || view === "edit") {
    const isEdit = view === "edit";

    return (
      <div className="space-y-4">
        <button
          onClick={isEdit ? handleCancelEdit : () => setView("list")}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </button>
        <h3 className="text-sm font-semibold text-zinc-300">{isEdit ? "Editar propuesta" : "Nueva propuesta"}</h3>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Título</label>
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Ej: Sistema de publicación en redes sociales"
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            Alcance <span className="text-zinc-600">— qué necesita el cliente</span>
          </label>
          <textarea
            value={scope} onChange={e => setScope(e.target.value)}
            placeholder="Describe el proyecto y las necesidades del cliente..."
            rows={3}
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Presupuesto <span className="text-zinc-600">(opcional)</span></label>
            <input type="text" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Ej: $50,000 MXN"
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Timeline <span className="text-zinc-600">(opcional)</span></label>
            <input type="text" value={timeline} onChange={e => setTimeline(e.target.value)} placeholder="Ej: 6 semanas"
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/40 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <input
              type="checkbox"
              checked={showPricing}
              onChange={e => {
                setShowPricing(e.target.checked);
                if (e.target.checked && priceLines.length === 0) addPriceLine();
              }}
              className="h-3.5 w-3.5 rounded border-white/[0.2] bg-zinc-900/40 accent-cyan-500"
            />
            Agregar precios
          </label>

          {showPricing && (
            <div className="mt-2 space-y-2">
              {priceLines.map((line) => (
                <div key={line.key} className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={line.concept}
                      onChange={e => updatePriceLine(line.key, { concept: e.target.value })}
                      placeholder="Concepto (ej. Costo Desarrollo: app + dominio 1 año incluido)"
                      className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
                    />
                    <button
                      onClick={() => removePriceLine(line.key)}
                      title="Eliminar"
                      className="flex-shrink-0 text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.amount || ""}
                      onChange={e => updatePriceLine(line.key, { amount: Number(e.target.value) })}
                      placeholder="Monto"
                      className="rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
                    />
                    <select
                      value={line.frequency}
                      onChange={e => updatePriceLine(line.key, { frequency: e.target.value as BillingFrequency })}
                      className="rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
                    >
                      {PRICE_FREQUENCIES.map(f => (
                        <option key={f} value={f}>{BILLING_FREQUENCY_LABELS[f]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <button
                onClick={addPriceLine}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.10] py-2 text-xs text-zinc-500 transition-all hover:border-cyan-500/30 hover:text-cyan-300"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar concepto de cobro
              </button>
              <p className="text-[10px] text-zinc-600">
                La frecuencia ya cubre cobros recurrentes — deja &ldquo;Único&rdquo; para un cobro
                de una sola vez, o elige mensual/trimestral/semestral/anual para que se repita.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleGenerate} disabled={!scope.trim() || generating}
          className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-xs font-medium text-purple-300 transition-all hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {generating ? "Generando con IA..." : "Generar con IA"}
        </button>

        {generatedData && (
          <div className="space-y-3 rounded-xl border border-purple-500/10 bg-purple-500/5 p-4">
            <p className="text-xs font-medium text-purple-300">Contenido generado — editable antes de guardar</p>
            {(["solution", "deliverables", "benefits"] as const).map((field) => (
              <div key={field}>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  {field === "solution" ? "Solución propuesta" : field === "deliverables" ? "Entregables" : "Beneficios"}
                </label>
                <textarea
                  value={generatedData[field]}
                  onChange={e => setGeneratedData(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
                  rows={field === "deliverables" ? 4 : 3}
                  className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none resize-none"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={isEdit ? handleSaveEdit : handleSave}
            disabled={!title.trim() || !scope.trim() || saving}
            className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar propuesta"}
          </button>
          <button
            onClick={isEdit ? handleCancelEdit : () => setView("list")}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ── DETAIL ─────────────────────────────────────────────────────────────────

  if (!selected) return null;

  const hasPublicLink = !!selected.publicToken;

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={() => { setSelected(null); setView("list"); }} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">{selected.title}</h3>
          {selected.reference && (
            <span className="text-[10px] font-mono text-zinc-600">{selected.reference}</span>
          )}
        </div>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${STATUS_CONFIG[selected.status].classes}`}>
          {STATUS_CONFIG[selected.status].label}
        </span>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleOpenEdit}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-all"
        >
          <Pencil className="h-3 w-3" /> Editar
        </button>
        <button
          onClick={handleSendEmail}
          disabled={sendingEmail || !clientEmail}
          title={!clientEmail ? "Agrega un email al cliente para poder enviarle la propuesta" : undefined}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {emailSent ? <Check className="h-3 w-3 text-green-400" /> : <Mail className="h-3 w-3" />}
          {sendingEmail ? "Enviando..." : emailSent ? "¡Enviado!" : "Enviar por correo"}
        </button>
        <button
          onClick={() => printProposalPdf(selected.id)}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-all"
        >
          <Printer className="h-3 w-3" /> Imprimir
        </button>
        <a
          href={`/api/documents/proposal-pdf?proposalId=${selected.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-all"
        >
          <Download className="h-3 w-3" /> Descargar PDF
        </a>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-3">
        <div className="flex items-center gap-0">
          {TIMELINE_STEPS.map((step, i) => {
            const isLast = i === TIMELINE_STEPS.length - 1;
            const dateVal = selected[step.field];
            const isDecision = step.key === "decidida";
            const done = isDecision
              ? !!(selected.acceptedAt)
              : !!dateVal;

            const displayLabel = isDecision
              ? (selected.status === "rechazada" ? "Rechazada" : "Aceptada")
              : step.label;

            return (
              <div key={step.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 min-w-0">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${done ? (isDecision && selected.status === "rechazada" ? "bg-red-400" : "bg-green-400") : "bg-zinc-700"}`} />
                  <span className="text-[0.55rem] text-zinc-600 text-center leading-tight px-1">
                    {displayLabel}
                  </span>
                  {dateVal && (
                    <span className="text-[0.5rem] text-zinc-700 text-center">{formatDate(dateVal)}</span>
                  )}
                </div>
                {!isLast && (
                  <div className={`flex-1 h-px mx-1 flex-shrink-0 ${done ? "bg-green-500/30" : "bg-zinc-800"}`} />
                )}
              </div>
            );
          })}
        </div>
        {selected.viewCount ? (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.04]">
            <Eye className="h-3 w-3 text-purple-400/60" />
            <span className="text-[10px] text-zinc-600">
              Vista {selected.viewCount} {selected.viewCount === 1 ? "vez" : "veces"}
              {selected.viewedAt && ` · Primera vez el ${formatDate(selected.viewedAt)}`}
            </span>
          </div>
        ) : null}
      </div>

      {/* Publish / Share panel */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-zinc-400">Enlace de cliente</p>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
              hasPublicLink
                ? "border-zinc-600/40 bg-zinc-800/40 text-zinc-400 hover:text-zinc-200"
                : "border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
            }`}
          >
            {publishing ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : hasPublicLink ? (
              <RefreshCw className="h-3 w-3" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            {publishing ? "Generando..." : hasPublicLink ? "Actualizar enlace" : "Publicar propuesta"}
          </button>
        </div>

        {hasPublicLink ? (
          <div className="space-y-2">
            {/* URL */}
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2">
              <Link2 className="h-3 w-3 text-zinc-600 flex-shrink-0" />
              <span className="flex-1 text-xs text-zinc-400 truncate font-mono">
                {proposalUrl(selected.publicToken!)}
              </span>
              <CopyButton text={proposalUrl(selected.publicToken!)}>Copiar URL</CopyButton>
            </div>

            {/* Quick share */}
            <div className="flex flex-wrap gap-2">
              <CopyButton text={whatsappText(selected)}>
                <MessageCircle className="h-3 w-3" />
                Texto WhatsApp
              </CopyButton>
              <CopyButton text={emailText(selected)}>
                <Mail className="h-3 w-3" />
                Borrador email
              </CopyButton>
            </div>

            {/* Version history */}
            {(selected.versions?.length ?? 0) > 1 && (
              <div>
                <button
                  onClick={() => setShowVersions(v => !v)}
                  className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showVersions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {selected.versions!.length} versiones guardadas
                </button>
                {showVersions && (
                  <div className="mt-2 space-y-1">
                    {[...selected.versions!].reverse().map(v => (
                      <div key={v.version} className="flex items-center gap-2 rounded-lg border border-white/[0.04] px-2.5 py-1.5">
                        <span className="text-[10px] font-mono font-semibold text-zinc-500">v{v.version}</span>
                        <span className="flex-1 text-[10px] text-zinc-400 truncate">{v.title}</span>
                        <span className="text-[10px] text-zinc-700">{formatDate(v.savedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-600">
            Genera un enlace único para que tu cliente pueda ver la propuesta, descargar el PDF y aceptarla directamente.
          </p>
        )}
      </div>

      {/* Content sections */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        <p className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Alcance</p>
        <KnowledgeMarkdown content={selected.scope} />
      </div>

      {selected.solution && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
          <p className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Solución propuesta</p>
          <KnowledgeMarkdown content={selected.solution} />
        </div>
      )}

      {selected.deliverables && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
          <p className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Entregables</p>
          <KnowledgeMarkdown content={selected.deliverables} />
        </div>
      )}

      {selected.benefits && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
          <p className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Beneficios</p>
          <KnowledgeMarkdown content={selected.benefits} />
        </div>
      )}

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

      {/* Status change — botones, no dropdown */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Estado</label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_CONFIG) as Proposal["status"][]).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusChange(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                selected.status === s
                  ? STATUS_CONFIG[s].classes
                  : "border-white/[0.06] bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="pt-1 flex flex-wrap gap-2">
        {selected.contractId ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs font-medium text-green-400">Contrato generado</span>
          </div>
        ) : selected.status === "rechazada" ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
            <XCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs font-medium text-red-400">Propuesta rechazada</span>
          </div>
        ) : null}

        {selected.status === "aceptada" && !selected.contractId && (
          <button
            onClick={() => onConvertToContract?.(selected.id)}
            className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300 transition-all hover:bg-amber-500/20"
          >
            Convertir a contrato
          </button>
        )}

        {selected.contractId && (
          <span className="text-xs text-zinc-600 self-center">ID contrato: {selected.contractId.slice(0, 8)}…</span>
        )}
      </div>

      {/* View status info */}
      {hasPublicLink && selected.status !== "aceptada" && selected.status !== "rechazada" && (
        <div className="flex items-center gap-2 text-xs text-zinc-600 border-t border-white/[0.04] pt-3">
          <Clock className="h-3 w-3" />
          <span>
            {selected.status === "vista"
              ? `Cliente vio la propuesta · ${selected.viewCount ?? 0} ${(selected.viewCount ?? 1) === 1 ? "visita" : "visitas"}`
              : "Esperando que el cliente abra el enlace"}
          </span>
        </div>
      )}
    </div>
  );
}
