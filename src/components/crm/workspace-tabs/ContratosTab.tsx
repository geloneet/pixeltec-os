"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import type { Contract, IATemplate } from "@/types/documents";
import { getContracts, createContract, updateContract, createContractVersion } from "@/lib/documents/contracts";
import { getTemplates } from "@/lib/documents/ia-templates";

// ── Helpers ────────────────────────────────────────────────────────────────────

function hydrateContent(content: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce(
    (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, val),
    content,
  );
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Contract["status"], { label: string; classes: string }> = {
  borrador:    { label: "Borrador",    classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
  en_revision: { label: "En revisión", classes: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
  firmado:     { label: "Firmado",     classes: "bg-green-500/15 text-green-300 border-green-500/20" },
  vencido:     { label: "Vencido",     classes: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  cancelado:   { label: "Cancelado",   classes: "bg-red-500/15 text-red-400 border-red-500/20" },
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ContratosTab({ clientId }: Props) {
  const firestore = useFirestore();
  const user = useUser();

  // View state
  const [view, setView] = useState<"list" | "create" | "detail">("list");

  // Data
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<IATemplate[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  // Create form
  const [selectedTemplate, setSelectedTemplate] = useState<IATemplate | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  // Detail edit
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadContracts = useCallback(async () => {
    if (!firestore || !user) return;
    setLoading(true);
    try {
      const data = await getContracts(firestore, user.uid, clientId);
      setContracts(data);
    } finally {
      setLoading(false);
    }
  }, [firestore, user, clientId]);

  const loadTemplates = useCallback(async () => {
    if (!firestore || !user) return;
    const data = await getTemplates(firestore, user.uid, "contrato");
    setTemplates(data);
  }, [firestore, user]);

  useEffect(() => { loadContracts(); }, [loadContracts]);
  useEffect(() => { if (view === "create") loadTemplates(); }, [view, loadTemplates]);

  // ── LIST view ─────────────────────────────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Contratos</h3>
          <button
            onClick={() => setView("create")}
            className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
          >
            + Nuevo contrato
          </button>
        </div>

        {/* Empty state */}
        {!loading && contracts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-3 h-8 w-8 text-zinc-600" />
            <p className="mb-3 text-sm font-medium text-zinc-400">Sin contratos</p>
            <button
              onClick={() => setView("create")}
              className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
            >
              Crear primer contrato
            </button>
          </div>
        )}

        {/* Contract rows */}
        {contracts.map((contract) => (
          <button
            key={contract.id}
            onClick={() => { setSelectedContract(contract); setView("detail"); }}
            className="w-full text-left rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 hover:border-white/[0.10] transition-all"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-zinc-200 truncate">{contract.title}</span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${STATUS_CONFIG[contract.status].classes}`}>
                {STATUS_CONFIG[contract.status].label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span>v{contract.version}</span>
              <span>{new Date(contract.createdAt).toLocaleDateString("es-MX")}</span>
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
        <h3 className="text-sm font-semibold text-zinc-300">Nuevo contrato</h3>

        {/* Template selector */}
        {!selectedTemplate && (
          <div>
            <p className="mb-2 text-xs text-zinc-500">Selecciona una plantilla</p>
            <div className="space-y-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(t);
                    setNewTitle(t.name);
                    const init: Record<string, string> = {};
                    t.variables.forEach((v) => { init[v] = ""; });
                    setVarValues(init);
                  }}
                  className="w-full text-left rounded-xl border border-white/[0.06] bg-zinc-900/20 p-3 hover:border-cyan-500/20 transition-all"
                >
                  <span className="text-sm font-medium text-zinc-200">{t.name}</span>
                  {t.description && (
                    <p className="mt-0.5 text-xs text-zinc-500">{t.description}</p>
                  )}
                </button>
              ))}

              {templates.length === 0 && (
                <p className="text-xs text-zinc-600">
                  No hay plantillas de tipo &quot;Contrato&quot;. Créalas en Centro IA.
                </p>
              )}

              {/* Blank option */}
              <button
                onClick={() => {
                  setSelectedTemplate({
                    id: "__blank__",
                    name: "",
                    variables: [],
                    content: "",
                    type: "contrato",
                    uid: "",
                    description: "",
                    isDefault: false,
                    version: 1,
                    createdAt: "",
                    updatedAt: "",
                  });
                  setNewTitle("");
                  setVarValues({});
                }}
                className="w-full text-left rounded-xl border border-dashed border-white/[0.06] p-3 hover:border-white/[0.12] transition-all text-xs text-zinc-500"
              >
                + Empezar en blanco
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        {selectedTemplate && (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Título</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
                placeholder="Contrato de desarrollo web"
              />
            </div>

            {/* Variable fields */}
            {selectedTemplate.variables.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-zinc-400">Variables del contrato</p>
                {selectedTemplate.variables.map((v) => (
                  <div key={v}>
                    <label className="mb-1 block font-mono text-xs text-zinc-500">{`{{${v}}}`}</label>
                    <input
                      value={varValues[v] ?? ""}
                      onChange={(e) => setVarValues((prev) => ({ ...prev, [v]: e.target.value }))}
                      className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
                      placeholder={v.replace(/_/g, " ")}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!newTitle.trim() || !firestore || !user) return;
                  setCreating(true);
                  try {
                    const content =
                      selectedTemplate.id === "__blank__"
                        ? ""
                        : hydrateContent(selectedTemplate.content, varValues);
                    await createContract(firestore, user.uid, clientId, {
                      title: newTitle.trim(),
                      content,
                      status: "borrador",
                      signers: [],
                      variables: varValues,
                      templateId: selectedTemplate.id === "__blank__" ? undefined : selectedTemplate.id,
                    });
                    setView("list");
                    setSelectedTemplate(null);
                    setNewTitle("");
                    setVarValues({});
                    await loadContracts();
                  } finally {
                    setCreating(false);
                  }
                }}
                disabled={!newTitle.trim() || creating}
                className="flex-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creating ? "Creando..." : "Crear contrato"}
              </button>
              <button
                onClick={() => { setSelectedTemplate(null); setNewTitle(""); setVarValues({}); }}
                className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-500 transition-all hover:text-zinc-300"
              >
                Atrás
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── DETAIL view ───────────────────────────────────────────────────────────────

  if (!selectedContract) return null;

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        onClick={() => setView("list")}
        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver
      </button>

      {/* Title + status card */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        {editingTitle ? (
          <div className="mb-2 flex gap-2">
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              autoFocus
              className="flex-1 rounded-lg border border-cyan-500/40 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none"
            />
            <button
              onClick={async () => {
                if (!firestore || !titleDraft.trim()) return;
                setSaving(true);
                await updateContract(firestore, selectedContract.id, { title: titleDraft.trim() });
                setSelectedContract((prev) => prev ? { ...prev, title: titleDraft.trim() } : prev);
                setEditingTitle(false);
                setSaving(false);
                loadContracts();
              }}
              disabled={saving}
              className="px-2 text-xs text-cyan-300"
            >
              Guardar
            </button>
            <button onClick={() => setEditingTitle(false)} className="px-2 text-xs text-zinc-500">
              ✕
            </button>
          </div>
        ) : (
          <div className="mb-2 flex items-center gap-2">
            <h3 className="flex-1 text-sm font-semibold text-zinc-100">{selectedContract.title}</h3>
            <button
              onClick={() => { setTitleDraft(selectedContract.title); setEditingTitle(true); }}
              className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
            >
              Editar
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CONFIG[selectedContract.status].classes}`}>
            {STATUS_CONFIG[selectedContract.status].label}
          </span>
          <span>v{selectedContract.version}</span>
          <span>{new Date(selectedContract.createdAt).toLocaleDateString("es-MX")}</span>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap gap-2">
        {/* Status change */}
        <select
          value={selectedContract.status}
          onChange={async (e) => {
            if (!firestore) return;
            const newStatus = e.target.value as Contract["status"];
            await updateContract(firestore, selectedContract.id, { status: newStatus });
            setSelectedContract((prev) => prev ? { ...prev, status: newStatus } : prev);
            loadContracts();
          }}
          className="rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="borrador">Borrador</option>
          <option value="en_revision">En revisión</option>
          <option value="firmado">Firmado</option>
          <option value="vencido">Vencido</option>
          <option value="cancelado">Cancelado</option>
        </select>

        {/* New version */}
        <button
          onClick={async () => {
            if (!firestore || !user) return;
            await createContractVersion(firestore, selectedContract.id, user.uid, clientId);
            await loadContracts();
            setView("list");
          }}
          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 transition-all hover:text-zinc-200"
        >
          Nueva versión
        </button>

        {/* Download PDF */}
        <a
          href={`/api/documents/contract-pdf?contractId=${selectedContract.id}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 transition-all hover:text-zinc-200"
        >
          Descargar PDF
        </a>
      </div>

      {/* Content preview */}
      {selectedContract.content && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-400">Contenido</p>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-400">
              {selectedContract.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
