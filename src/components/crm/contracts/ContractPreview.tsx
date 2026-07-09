"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BILLING_FREQUENCY_LABELS } from "@/types/documents";
import type { ContractSection, BillingItemDraft } from "@/types/documents";

interface Props {
  clientName: string;
  proposalReference?: string;
  title: string;
  startDate: string;
  endDate?: string;
  sections: ContractSection[];
  overrides: Record<string, string>;
  onOverrideChange: (key: string, body: string) => void;
  billingItems: BillingItemDraft[];
  missing: string[];
  confirming: boolean;
  error: string | null;
  onConfirm: () => void;
  onEditData: () => void;
  onCancel: () => void;
}

function SectionRow({
  section,
  overrideBody,
  onChange,
}: {
  section: ContractSection;
  overrideBody?: string;
  onChange: (body: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const body = overrideBody ?? section.body;

  return (
    <div className="border-b border-white/[0.06] py-4 last:border-b-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{section.title}</h4>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-zinc-600 transition-colors hover:text-cyan-300"
        >
          <Pencil className="h-2.5 w-2.5" />
          {editing ? "Listo" : "Editar"}
        </button>
      </div>
      {editing ? (
        <textarea
          value={body}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-cyan-500/30 bg-zinc-900/60 px-3 py-2 text-sm leading-relaxed text-zinc-200 focus:border-cyan-500/50 focus:outline-none"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{body}</p>
      )}
    </div>
  );
}

export function ContractPreview({
  clientName,
  proposalReference,
  title,
  startDate,
  endDate,
  sections,
  overrides,
  onOverrideChange,
  billingItems,
  missing,
  confirming,
  error,
  onConfirm,
  onEditData,
  onCancel,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Preview del contrato</p>
        <h3 className="text-sm font-semibold text-zinc-200">Revisa antes de confirmar</h3>
      </div>

      {/* Documento */}
      <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="mb-4 border-b border-white/[0.06] pb-4">
          <p className="text-base font-semibold text-zinc-100">{title}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>Cliente: <span className="text-zinc-300">{clientName}</span></span>
            {proposalReference && <span>Propuesta: <span className="text-zinc-300">{proposalReference}</span></span>}
            <span>Inicio: <span className="text-zinc-300">{startDate}</span></span>
            <span>Vigencia: <span className="text-zinc-300">{endDate ?? "Indefinida"}</span></span>
          </div>
        </div>

        {sections.map((s) => (
          <SectionRow
            key={s.key}
            section={s}
            overrideBody={overrides[s.key]}
            onChange={(body) => onOverrideChange(s.key, body)}
          />
        ))}
      </div>

      {/* Conceptos de cobro detectados */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        <p className="mb-3 text-xs font-semibold text-zinc-400">Conceptos de cobro detectados</p>
        {billingItems.length === 0 ? (
          <p className="text-xs text-zinc-600">Sin conceptos de cobro.</p>
        ) : (
          <div className="space-y-2">
            {billingItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-zinc-900/40 px-3 py-2">
                <span className="text-xs text-zinc-300">{item.concept || "(sin nombre)"}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">
                    {BILLING_FREQUENCY_LABELS[item.frequency]}
                  </span>
                  <span className="text-xs font-medium tabular-nums text-zinc-200">{formatCurrency(item.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {missing.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
          <div className="text-xs text-amber-300">
            <p className="mb-1 font-medium">Falta información antes de confirmar:</p>
            <ul className="list-inside list-disc space-y-0.5 text-amber-400/80">
              {missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
          <X className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={missing.length > 0 || confirming}
          className="flex-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {confirming ? "Confirmando..." : "Confirmar contrato"}
        </button>
        <button
          type="button"
          onClick={onEditData}
          disabled={confirming}
          className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-400 transition-all hover:text-zinc-200"
        >
          Editar datos
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-500 transition-all hover:text-zinc-300"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
