"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, FileText, Download, UserPlus, X, Check,
  Clock, CheckCircle2, AlertCircle, XCircle, FileCheck,
} from "lucide-react";
import { useUser } from "@/hooks/use-user";
import type { Contract, ContractSigner } from "@/types/documents";
import { getContracts, updateContract, createContractVersion } from "@/lib/documents/contracts";
import { ContractWizard } from "@/components/crm/contracts/ContractWizard";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX");
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Contract["status"], { label: string; classes: string; Icon: React.ComponentType<{ className?: string }> }> = {
  borrador:    { label: "Borrador",    classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",  Icon: FileText },
  en_revision: { label: "En revisión", classes: "bg-blue-500/15 text-blue-300 border-blue-500/20",  Icon: Clock },
  firmado:     { label: "Firmado",     classes: "bg-green-500/15 text-green-300 border-green-500/20", Icon: CheckCircle2 },
  vencido:     { label: "Vencido",     classes: "bg-amber-500/15 text-amber-400 border-amber-500/20", Icon: AlertCircle },
  cancelado:   { label: "Cancelado",   classes: "bg-red-500/15 text-red-400 border-red-500/20",      Icon: XCircle },
};

// Timeline steps
const TIMELINE: Array<{ status: Contract["status"]; label: string }> = [
  { status: "borrador", label: "Borrador" },
  { status: "en_revision", label: "En revisión" },
  { status: "firmado", label: "Firmado" },
];
const STATUS_ORDER: Record<Contract["status"], number> = {
  borrador: 0, en_revision: 1, firmado: 2, vencido: -1, cancelado: -1,
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  clientName: string;
  initialProposalId?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ContratosTab({ clientId, clientName, initialProposalId }: Props) {
  const user = useUser();

  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  // Detail
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Signers
  const [showAddSigner, setShowAddSigner] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [addingSign, setAddingSign] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────

  const loadContracts = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getContracts(user.uid, clientId);
      setContracts(data);
    } finally {
      setLoading(false);
    }
  }, [user, clientId]);

  useEffect(() => { loadContracts(); }, [loadContracts]);

  useEffect(() => {
    if (initialProposalId) setView("create");
  }, [initialProposalId]);

  // ── Signer handlers ───────────────────────────────────────────────────────

  const handleAddSigner = async () => {
    if (!selectedContract || !signerName.trim()) return;
    setAddingSign(true);
    try {
      const newSigner: ContractSigner = {
        name: signerName.trim(),
        email: signerEmail.trim(),
        role: signerRole.trim() || "Firmante",
      };
      const signers = [...(selectedContract.signers ?? []), newSigner];
      await updateContract(selectedContract.id, { signers });
      setSelectedContract(prev => prev ? { ...prev, signers } : prev);
      setSignerName(""); setSignerEmail(""); setSignerRole("");
      setShowAddSigner(false);
      await loadContracts();
    } finally {
      setAddingSign(false);
    }
  };

  const handleRemoveSigner = async (idx: number) => {
    if (!selectedContract) return;
    const signers = selectedContract.signers.filter((_, i) => i !== idx);
    await updateContract(selectedContract.id, { signers });
    setSelectedContract(prev => prev ? { ...prev, signers } : prev);
    await loadContracts();
  };

  const handleMarkSigned = async (idx: number) => {
    if (!selectedContract) return;
    const signers = selectedContract.signers.map((s, i) =>
      i === idx ? { ...s, signedAt: new Date().toISOString() } : s,
    );
    await updateContract(selectedContract.id, { signers });
    setSelectedContract(prev => prev ? { ...prev, signers } : prev);
    await loadContracts();
  };

  // ── LIST ─────────────────────────────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Contratos</h3>
          <button
            onClick={() => setView("create")}
            className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
          >
            + Nuevo contrato
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="text-xs text-zinc-500">Cargando...</span>
          </div>
        )}

        {!loading && contracts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileCheck className="mb-3 h-8 w-8 text-zinc-600" />
            <p className="mb-3 text-sm font-medium text-zinc-400">Sin contratos</p>
            <button
              onClick={() => setView("create")}
              className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
            >
              Crear primer contrato
            </button>
          </div>
        )}

        {contracts.map((contract) => {
          const st = STATUS_CONFIG[contract.status];
          const Icon = st.Icon;
          return (
            <button
              key={contract.id}
              onClick={() => { setSelectedContract(contract); setView("detail"); }}
              className="w-full text-left rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 hover:border-white/[0.10] transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-sm font-medium text-zinc-200 truncate">{contract.title}</span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${st.classes}`}>
                  <Icon className="h-2.5 w-2.5" />
                  {st.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-600">
                <span className="text-[10px] font-mono">v{contract.version}</span>
                <span>{formatDate(contract.createdAt)}</span>
                {contract.signers?.length > 0 && (
                  <span className="text-zinc-700">
                    {contract.signers.filter(s => !!s.signedAt).length}/{contract.signers.length} firmantes
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // ── CREATE (wizard) ─────────────────────────────────────────────────────

  if (view === "create") {
    return (
      <ContractWizard
        clientId={clientId}
        clientName={clientName}
        initialProposalId={initialProposalId}
        onDone={() => { setView("list"); loadContracts(); }}
        onCancel={() => setView("list")}
      />
    );
  }

  // ── DETAIL ─────────────────────────────────────────────────────────────────

  if (!selectedContract) return null;

  const st = STATUS_CONFIG[selectedContract.status];
  const StIcon = st.Icon;
  const currentStep = STATUS_ORDER[selectedContract.status];
  const allSigned = selectedContract.signers?.length > 0 &&
    selectedContract.signers.every(s => !!s.signedAt);

  return (
    <div className="space-y-4">
      <button onClick={() => setView("list")} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver
      </button>

      {/* Header */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        {editingTitle ? (
          <div className="flex gap-2 mb-2">
            <input
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              autoFocus
              className="flex-1 rounded-lg border border-cyan-500/40 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none"
            />
            <button
              onClick={async () => {
                if (!titleDraft.trim()) return;
                setSaving(true);
                await updateContract(selectedContract.id, { title: titleDraft.trim() });
                setSelectedContract(prev => prev ? { ...prev, title: titleDraft.trim() } : prev);
                setEditingTitle(false); setSaving(false);
                loadContracts();
              }}
              disabled={saving}
              className="px-3 text-xs font-medium text-cyan-300 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/10 transition-all"
            >
              {saving ? "..." : "Guardar"}
            </button>
            <button onClick={() => setEditingTitle(false)} className="px-2 text-xs text-zinc-500">✕</button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-zinc-100">{selectedContract.title}</h3>
            <button
              onClick={() => { setTitleDraft(selectedContract.title); setEditingTitle(true); }}
              className="text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0"
            >
              Editar
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${st.classes}`}>
            <StIcon className="h-2.5 w-2.5" />
            {st.label}
          </span>
          <span className="text-[10px] font-mono text-zinc-600">v{selectedContract.version}</span>
          <span className="text-xs text-zinc-600">{formatDate(selectedContract.createdAt)}</span>
        </div>
      </div>

      {/* Status timeline */}
      {currentStep >= 0 && (
        <div className="flex items-center gap-0 px-2">
          {TIMELINE.map((step, i) => {
            const isLast = i === TIMELINE.length - 1;
            const done = STATUS_ORDER[selectedContract.status] >= STATUS_ORDER[step.status];
            return (
              <div key={step.status} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${done ? "bg-green-400" : "bg-zinc-700"}`} />
                  <span className="text-[0.55rem] text-zinc-600 whitespace-nowrap">{step.label}</span>
                </div>
                {!isLast && <div className={`flex-1 h-px mx-1 ${done && STATUS_ORDER[selectedContract.status] > STATUS_ORDER[step.status] ? "bg-green-500/30" : "bg-zinc-800"}`} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions row */}
      <div className="flex flex-wrap gap-2">
        {selectedContract.status === "firmado" || selectedContract.status === "vencido" || selectedContract.status === "cancelado" ? (
          <span className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400">
            {selectedContract.status === "firmado" ? "Firmado" : selectedContract.status === "vencido" ? "Vencido" : "Cancelado"}
          </span>
        ) : (
          <button
            onClick={async () => {
              if (!window.confirm("¿Firmar este contrato? Se generarán los cobros y facturas asociados — esta acción no se puede deshacer.")) return;
              const { signContract } = await import("@/lib/documents/contracts");
              const result = await signContract(selectedContract.id);
              if (!result.ok) {
                alert(`No se pudo firmar: ${result.reason}`);
                return;
              }
              setSelectedContract(prev => prev ? { ...prev, status: "firmado" } : prev);
              loadContracts();
            }}
            className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-300 transition-all hover:bg-green-500/20"
          >
            Firmar contrato
          </button>
        )}

        <button
          onClick={async () => {
            if (!user) return;
            await createContractVersion(selectedContract.id, user.uid, clientId);
            await loadContracts();
            setView("list");
          }}
          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 transition-all hover:text-zinc-200"
        >
          Nueva versión
        </button>

        <a
          href={`/api/documents/contract-pdf?contractId=${selectedContract.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 transition-all hover:text-zinc-200"
        >
          <Download className="h-3 w-3" />
          Descargar PDF
        </a>
      </div>

      {/* Signers */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-zinc-400">Firmantes</p>
          {!showAddSigner && (
            <button
              onClick={() => setShowAddSigner(true)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <UserPlus className="h-3 w-3" />
              Agregar
            </button>
          )}
        </div>

        {showAddSigner && (
          <div className="mb-3 space-y-2 rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3">
            <input
              autoFocus value={signerName} onChange={e => setSignerName(e.target.value)}
              placeholder="Nombre completo *"
              className="w-full bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none border-b border-white/[0.06] pb-1.5"
            />
            <input
              value={signerEmail} onChange={e => setSignerEmail(e.target.value)}
              placeholder="correo@empresa.com"
              className="w-full bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none border-b border-white/[0.06] pb-1.5"
            />
            <input
              value={signerRole} onChange={e => setSignerRole(e.target.value)}
              placeholder="Rol (ej. Director, Cliente)"
              className="w-full bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddSigner}
                disabled={!signerName.trim() || addingSign}
                className="flex-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40 transition-all"
              >
                {addingSign ? "Agregando..." : "Agregar firmante"}
              </button>
              <button onClick={() => { setShowAddSigner(false); setSignerName(""); setSignerEmail(""); setSignerRole(""); }} className="text-xs text-zinc-600 hover:text-zinc-400">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {(selectedContract.signers?.length ?? 0) === 0 ? (
          <p className="text-xs text-zinc-600">Sin firmantes registrados.</p>
        ) : (
          <div className="space-y-2">
            {selectedContract.signers.map((signer, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-zinc-900/40 px-3 py-2">
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${signer.signedAt ? "bg-green-400" : "bg-zinc-600"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-300 truncate">{signer.name}</p>
                  <p className="text-[10px] text-zinc-600 truncate">{signer.role}{signer.email && ` · ${signer.email}`}</p>
                  {signer.signedAt && (
                    <p className="text-[10px] text-green-500/70">Firmó el {formatDate(signer.signedAt)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!signer.signedAt && (
                    <button
                      onClick={() => handleMarkSigned(i)}
                      title="Marcar como firmado"
                      className="text-zinc-600 hover:text-green-400 transition-colors"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveSigner(i)}
                    title="Eliminar firmante"
                    className="text-zinc-700 hover:text-red-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {allSigned && selectedContract.status !== "firmado" && (
              <p className="text-[10px] text-green-400/70 mt-1">
                Todos firmaron — marca el contrato como &quot;Firmado&quot; desde el selector de estado.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {selectedContract.content && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-400">Contenido del contrato</p>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
              {selectedContract.content}
            </p>
          </div>
        </div>
      )}

      {/* Notes */}
      {selectedContract.notes && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
          <p className="mb-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Notas internas</p>
          <p className="text-xs text-zinc-400 whitespace-pre-wrap">{selectedContract.notes}</p>
        </div>
      )}
    </div>
  );
}
