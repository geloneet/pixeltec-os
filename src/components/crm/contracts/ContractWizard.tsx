"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { getProposals } from "@/lib/documents/proposals";
import { confirmContractFromWizard } from "@/lib/documents/contracts";
import { buildContractSections } from "@/lib/contracts/base-template";
import {
  BILLING_FREQUENCY_LABELS,
  type Proposal,
  type BillingFrequency,
  type BillingItemDraft,
} from "@/types/documents";
import { ContractPreview } from "./ContractPreview";

const CONTRACT_TYPES = ["Desarrollo web", "Mantenimiento", "Consultoría", "Servicios recurrentes", "Otro"];
const FREQUENCIES: BillingFrequency[] = ["unico", "mensual", "trimestral", "semestral", "anual"];

interface DraftLine extends BillingItemDraft {
  key: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  clientId: string;
  clientName: string;
  onDone: () => void;
  onCancel: () => void;
}

export function ContractWizard({ clientId, clientName, onDone, onCancel }: Props) {
  const user = useUser();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Paso 1 — datos
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalId, setProposalId] = useState<string>("");
  const [contractType, setContractType] = useState(CONTRACT_TYPES[0]);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");

  // Paso 2 — conceptos de cobro
  const [lines, setLines] = useState<DraftLine[]>([]);

  // Paso 3 — preview
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProposals = useCallback(async () => {
    if (!user) return;
    const data = await getProposals(user.uid, clientId);
    setProposals(data);
  }, [user, clientId]);

  useEffect(() => { loadProposals(); }, [loadProposals]);

  const selectedProposal = proposals.find((p) => p.id === proposalId) ?? null;
  const effectiveTitle = title.trim() || `${contractType} — ${clientName}`;

  function addLine() {
    setLines((prev) => [
      ...prev,
      { key: crypto.randomUUID(), concept: "", amount: 0, frequency: "unico", dueDate: startDate },
    ]);
  }
  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const sections = useMemo(
    () =>
      buildContractSections({
        clientName,
        contractTitle: effectiveTitle,
        startDate,
        endDate: endDate || undefined,
        proposalReference: selectedProposal?.reference,
        scope: selectedProposal?.scope,
        deliverables: selectedProposal?.deliverables,
        billingItems: lines,
      }),
    [clientName, effectiveTitle, startDate, endDate, selectedProposal, lines],
  );

  const missing: string[] = [];
  if (lines.length === 0) missing.push("Al menos un concepto de cobro");
  if (lines.some((l) => !l.concept.trim())) missing.push("Concepto vacío en una línea de cobro");
  if (lines.some((l) => !(l.amount > 0))) missing.push("Monto inválido en una línea de cobro");

  async function handleConfirm() {
    if (!user || missing.length > 0) return;
    setConfirming(true);
    setError(null);
    try {
      await confirmContractFromWizard({
        clientId,
        proposalId: selectedProposal?.id,
        title: effectiveTitle,
        startDate,
        endDate: endDate || undefined,
        scope: selectedProposal?.scope,
        deliverables: selectedProposal?.deliverables,
        billingItems: lines.map(({ key: _key, ...rest }) => rest),
        sectionOverrides: overrides,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar el contrato");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onCancel} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver
      </button>

      <div className="flex items-center gap-2">
        {(["Datos", "Cobros", "Preview"] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                  step === n
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : step > n
                      ? "bg-zinc-800 text-zinc-400 border border-white/[0.06]"
                      : "bg-zinc-900 text-zinc-600 border border-white/[0.06]"
                }`}
              >
                {n}
              </div>
              <span className={`text-xs ${step === n ? "text-zinc-200" : "text-zinc-600"}`}>{label}</span>
              {n < 3 && <div className="h-px flex-1 bg-white/[0.06]" />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Título del contrato</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={effectiveTitle}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Tipo de contrato</label>
            <select
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
            >
              {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Propuesta relacionada (opcional)</label>
            <select
              value={proposalId}
              onChange={(e) => setProposalId(e.target.value)}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
            >
              <option value="">Sin propuesta relacionada</option>
              {proposals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.reference ? `${p.reference} — ` : ""}{p.title}{p.budget ? ` (${p.budget})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Fecha de inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Vigencia hasta (opcional)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!startDate}
            className="w-full rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continuar
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500">
            Agrega los conceptos de cobro del contrato. Cada uno generará su propio cobro en Finanzas al confirmar.
          </p>

          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.key} className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={line.concept}
                    onChange={(e) => updateLine(line.key, { concept: e.target.value })}
                    placeholder="Concepto (ej. Hosting anual)"
                    className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
                  />
                  <button
                    onClick={() => removeLine(line.key)}
                    title="Eliminar"
                    className="flex-shrink-0 text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.amount || ""}
                    onChange={(e) => updateLine(line.key, { amount: Number(e.target.value) })}
                    placeholder="Monto"
                    className="rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
                  />
                  <select
                    value={line.frequency}
                    onChange={(e) => updateLine(line.key, { frequency: e.target.value as BillingFrequency })}
                    className="rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>{BILLING_FREQUENCY_LABELS[f]}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={line.dueDate}
                    onChange={(e) => updateLine(line.key, { dueDate: e.target.value })}
                    className="rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={addLine}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.10] py-2.5 text-xs text-zinc-500 transition-all hover:border-cyan-500/30 hover:text-cyan-300"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar concepto de cobro
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(3)}
              className="flex-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
            >
              Ver preview
            </button>
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-500 transition-all hover:text-zinc-300"
            >
              Atrás
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <ContractPreview
          clientName={clientName}
          proposalReference={selectedProposal?.reference}
          title={effectiveTitle}
          startDate={startDate}
          endDate={endDate || undefined}
          sections={sections}
          overrides={overrides}
          onOverrideChange={(key, body) => setOverrides((prev) => ({ ...prev, [key]: body }))}
          billingItems={lines}
          missing={missing}
          confirming={confirming}
          error={error}
          onConfirm={handleConfirm}
          onEditData={() => setStep(1)}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}
