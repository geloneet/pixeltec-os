"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, FileText, Download, UserPlus, X, Check,
  Clock, CheckCircle2, AlertCircle, XCircle, FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/hooks/use-user";
import { useCRM } from "@/components/crm/CRMContextCore";
import type { Contract, ContractSigner } from "@/types/documents";
import {
  getContracts,
  updateContract,
  createContractVersion,
  signContract,
  attachProjectToContract,
} from "@/lib/documents/contracts";
import { ContractWizard } from "@/components/crm/contracts/ContractWizard";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX");
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Contract["status"], { label: string; classes: string; Icon: React.ComponentType<{ className?: string }> }> = {
  borrador:    { label: "Borrador",    classes: "bg-muted text-muted-foreground border-border",  Icon: FileText },
  en_revision: { label: "En revisión", classes: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",  Icon: Clock },
  firmado:     { label: "Firmado",     classes: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/20", Icon: CheckCircle2 },
  vencido:     { label: "Vencido",     classes: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20", Icon: AlertCircle },
  cancelado:   { label: "Cancelado",   classes: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",      Icon: XCircle },
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
  /** Cuando viene de "Convertir a contrato" en una propuesta: abre el wizard prellenado. */
  initialProposalId?: string | null;
  onConsumedInitialProposal?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ContratosTab({ clientId, clientName, initialProposalId, onConsumedInitialProposal }: Props) {
  const user = useUser();
  const crm = useCRM();

  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  // Llegada desde "Convertir a contrato" en Propuesta: abrir el wizard directo.
  useEffect(() => {
    if (initialProposalId) setView("create");
  }, [initialProposalId]);

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

  // ── Firma del contrato ──────────────────────────────────────────────────
  // Un solo handler, un solo clic: firma + cobros (servidor, atómico) ->
  // proyecto CRM (contexto cliente, único camino seguro para no chocar con
  // la reconciliación de crm-sync) -> vincular projectId al contrato.
  // Reintentable: si ya quedó firmado pero sin proyecto, retoma desde ahí
  // sin volver a firmar ni duplicar cobros ni duplicar el proyecto (busca
  // primero si el contexto CRM ya tiene un proyecto con este contractId).
  const handleSignContract = async () => {
    if (!selectedContract || signing) return;
    setSigning(true);
    setSignError(null);
    try {
      const result = await signContract(selectedContract.id);
      setSelectedContract(prev => prev ? { ...prev, status: result.status } : prev);

      let projectPgId = result.projectId;
      if (!projectPgId) {
        if (crm.loading) throw new Error("El CRM todavía está cargando — espera un momento y reintenta.");

        const client = crm.clients.find(c => c.id === clientId);
        const existingProject = client?.projects.find(p => p.contractId === selectedContract.id);

        const clientProjectId = existingProject
          ? existingProject.id
          : crm.addProject(clientId, {
              name: selectedContract.title,
              domain: "",
              budget: (selectedContract.billingItemDrafts ?? []).reduce((sum, i) => sum + i.amount, 0),
              annual: 0,
              budgetIva: "none",
              annualIva: "none",
              tech: "",
              contractId: selectedContract.id,
            });
        if (!clientProjectId) {
          // addProject ya mostró el toast de validación.
          setSigning(false);
          return;
        }

        const attached = await attachProjectToContract(selectedContract.id, clientProjectId);
        projectPgId = attached.projectId;
      }

      setSelectedContract(prev => prev ? { ...prev, projectId: projectPgId ?? undefined } : prev);
      toast.success("Contrato firmado y proyecto creado");
      await loadContracts();
    } catch (err) {
      // El contrato NO se revierte: queda firmado, con el proyecto pendiente
      // de vincular. El error es accionable — el mismo botón reintenta.
      setSignError(err instanceof Error ? err.message : "No se pudo completar la firma");
    } finally {
      setSigning(false);
    }
  };

  // ── LIST ─────────────────────────────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Contratos</h3>
          <button
            onClick={() => setView("create")}
            className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
          >
            + Nuevo contrato
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="text-xs text-muted-foreground">Cargando...</span>
          </div>
        )}

        {!loading && contracts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileCheck className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="mb-3 text-sm font-medium text-muted-foreground">Sin contratos</p>
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
              onClick={() => { setSelectedContract(contract); setSignError(null); setView("detail"); }}
              className="w-full text-left rounded-xl border border-border bg-card p-4 hover:bg-secondary/40 transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-sm font-medium text-foreground truncate">{contract.title}</span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${st.classes}`}>
                  <Icon className="h-2.5 w-2.5" />
                  {st.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="text-[10px] font-mono">v{contract.version}</span>
                <span>{formatDate(contract.createdAt)}</span>
                {contract.signers?.length > 0 && (
                  <span className="text-muted-foreground">
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
        initialProposalId={initialProposalId ?? undefined}
        onDone={async (newContractId) => {
          onConsumedInitialProposal?.();
          const data = await getContracts(user?.uid ?? "", clientId);
          setContracts(data);
          const created = data.find(c => c.id === newContractId) ?? null;
          if (created) {
            setSelectedContract(created);
            setView("detail");
          } else {
            setView("list");
          }
        }}
        onCancel={() => { onConsumedInitialProposal?.(); setView("list"); }}
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
      <button onClick={() => setView("list")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver
      </button>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4">
        {editingTitle ? (
          <div className="flex gap-2 mb-2">
            <input
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              autoFocus
              className="flex-1 rounded-lg border border-cyan-500/40 bg-secondary px-3 py-1.5 text-sm text-foreground focus:outline-none"
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
            <button onClick={() => setEditingTitle(false)} className="px-2 text-xs text-muted-foreground">✕</button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-foreground">{selectedContract.title}</h3>
            <button
              onClick={() => { setTitleDraft(selectedContract.title); setEditingTitle(true); }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
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
          <span className="text-[10px] font-mono text-muted-foreground">v{selectedContract.version}</span>
          <span className="text-xs text-muted-foreground">{formatDate(selectedContract.createdAt)}</span>
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
                  <div className={`h-2 w-2 rounded-full ${done ? "bg-green-400" : "bg-muted-foreground/30"}`} />
                  <span className="text-[0.55rem] text-muted-foreground whitespace-nowrap">{step.label}</span>
                </div>
                {!isLast && <div className={`flex-1 h-px mx-1 ${done && STATUS_ORDER[selectedContract.status] > STATUS_ORDER[step.status] ? "bg-green-500/30" : "bg-muted-foreground/20"}`} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Firma pendiente de vincular proyecto — reintentable */}
      {selectedContract.status === "firmado" && !selectedContract.projectId && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {signError ?? "El contrato está firmado pero falta crear/vincular el proyecto CRM."}
          </p>
          <button
            onClick={handleSignContract}
            disabled={signing}
            className="flex-shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-40"
          >
            {signing ? "Reintentando…" : "Reintentar"}
          </button>
        </div>
      )}

      {/* Estado — botones, no dropdown */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Estado</label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_CONFIG) as Contract["status"][]).map(s => (
            <button
              key={s}
              type="button"
              disabled={signing || (s === "firmado" && crm.loading)}
              title={s === "firmado" && crm.loading ? "Cargando CRM…" : undefined}
              onClick={async () => {
                if (s === "firmado") {
                  await handleSignContract();
                  return;
                }
                await updateContract(selectedContract.id, { status: s });
                setSelectedContract(prev => prev ? { ...prev, status: s } : prev);
                loadContracts();
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40 ${
                selectedContract.status === s
                  ? STATUS_CONFIG[s].classes
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "firmado" && signing ? "Firmando…" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
        {crm.loading && (
          <p className="mt-1 text-[10px] text-muted-foreground">Cargando CRM… espera antes de firmar.</p>
        )}
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={async () => {
            if (!user) return;
            await createContractVersion(selectedContract.id, user.uid, clientId);
            await loadContracts();
            setView("list");
          }}
          className="rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-secondary/70 hover:text-foreground"
        >
          Nueva versión
        </button>

        <a
          href={`/api/documents/contract-pdf?contractId=${selectedContract.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-secondary/70 hover:text-foreground"
        >
          <Download className="h-3 w-3" />
          Descargar PDF
        </a>
      </div>

      {/* Signers */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground">Firmantes</p>
          {!showAddSigner && (
            <button
              onClick={() => setShowAddSigner(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserPlus className="h-3 w-3" />
              Agregar
            </button>
          )}
        </div>

        {showAddSigner && (
          <div className="mb-3 space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
            <input
              autoFocus value={signerName} onChange={e => setSignerName(e.target.value)}
              placeholder="Nombre completo *"
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none border-b border-border pb-1.5"
            />
            <input
              value={signerEmail} onChange={e => setSignerEmail(e.target.value)}
              placeholder="correo@empresa.com"
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none border-b border-border pb-1.5"
            />
            <input
              value={signerRole} onChange={e => setSignerRole(e.target.value)}
              placeholder="Rol (ej. Director, Cliente)"
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddSigner}
                disabled={!signerName.trim() || addingSign}
                className="flex-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40 transition-all"
              >
                {addingSign ? "Agregando..." : "Agregar firmante"}
              </button>
              <button onClick={() => { setShowAddSigner(false); setSignerName(""); setSignerEmail(""); setSignerRole(""); }} className="text-xs text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {(selectedContract.signers?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">Sin firmantes registrados.</p>
        ) : (
          <div className="space-y-2">
            {selectedContract.signers.map((signer, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${signer.signedAt ? "bg-green-400" : "bg-muted-foreground/30"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{signer.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{signer.role}{signer.email && ` · ${signer.email}`}</p>
                  {signer.signedAt && (
                    <p className="text-[10px] text-green-500/70">Firmó el {formatDate(signer.signedAt)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!signer.signedAt && (
                    <button
                      onClick={() => handleMarkSigned(i)}
                      title="Marcar como firmado"
                      className="text-muted-foreground hover:text-green-400 transition-colors"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveSigner(i)}
                    title="Eliminar firmante"
                    className="text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {allSigned && selectedContract.status !== "firmado" && (
              <p className="text-[10px] text-green-400/70 mt-1">
                Todos firmaron — marca el contrato como &quot;Firmado&quot; en los botones de estado.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {selectedContract.content && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Contenido del contrato</p>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-4">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {selectedContract.content}
            </p>
          </div>
        </div>
      )}

      {/* Notes */}
      {selectedContract.notes && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Notas internas</p>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{selectedContract.notes}</p>
        </div>
      )}
    </div>
  );
}
