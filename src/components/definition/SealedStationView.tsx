"use client";

import { useState } from "react";
import { Lock, ChevronDown, ChevronRight, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { KnowledgeMarkdown } from "@/components/crm/KnowledgeMarkdown";
import type { DefinitionStation } from "@/lib/definition/types";

interface Props {
  station: DefinitionStation;
  title: string;
  sealName: string;
  content: string;
  sealedAtLabel: string | null;
  sealedByName: string | null;
  /** true si hay estaciones downstream que se invalidarán al reabrir. */
  hasDownstream: boolean;
  onReopen: (reason: string) => Promise<void>;
  defaultOpen?: boolean;
}

/**
 * Vista de una estación SELLADA: documento congelado (no editable) + metadatos
 * del sello. Permite reabrir con motivo obligatorio (invalida los sellos
 * downstream, con aviso).
 */
export function SealedStationView({
  title,
  sealName,
  content,
  sealedAtLabel,
  sealedByName,
  hasDownstream,
  onReopen,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submitReopen = async () => {
    if (reason.trim().length < 3 || busy) return;
    setBusy(true);
    try {
      await onReopen(reason.trim());
    } finally {
      setBusy(false);
      setReopening(false);
      setReason("");
    }
  };

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-zinc-500" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-zinc-500" />
        )}
        <Lock className="h-3.5 w-3.5 flex-shrink-0 text-cyan-400" />
        <span className="text-sm font-semibold text-zinc-100">{title}</span>
        <span className="truncate text-xs text-zinc-500">· {sealName}</span>
        {sealedAtLabel && (
          <span className="ml-auto hidden flex-shrink-0 text-[11px] text-zinc-600 sm:block">
            Sellado {sealedAtLabel}
            {sealedByName ? ` · ${sealedByName}` : ""}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-4 py-4">
          <KnowledgeMarkdown content={content} />

          <div className="mt-4 border-t border-white/[0.06] pt-3">
            {!reopening ? (
              <button
                type="button"
                onClick={() => setReopening(true)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-amber-400"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir estación
              </button>
            ) : (
              <div className="space-y-2">
                {hasDownstream && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300/90">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    Reabrir esta estación invalidará los sellos de las estaciones
                    posteriores (tendrás que volver a aprobarlas).
                  </div>
                )}
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="¿Por qué reabres esta estación? (queda registrado)"
                  className="w-full resize-none rounded-md border border-zinc-700/50 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={submitReopen}
                    disabled={reason.trim().length < 3 || busy}
                    className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Confirmar reapertura
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReopening(false);
                      setReason("");
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
