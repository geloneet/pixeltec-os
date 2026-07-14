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
    <div className="rounded-xl border border-cyan-500/20 bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}
        <Lock className="h-3.5 w-3.5 flex-shrink-0 text-cyan-400" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="truncate text-xs text-muted-foreground">· {sealName}</span>
        {sealedAtLabel && (
          <span className="ml-auto hidden flex-shrink-0 text-[11px] text-muted-foreground/70 sm:block">
            Sellado {sealedAtLabel}
            {sealedByName ? ` · ${sealedByName}` : ""}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <KnowledgeMarkdown content={content} />

          <div className="mt-4 border-t border-border pt-3">
            {!reopening ? (
              <button
                type="button"
                onClick={() => setReopening(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-amber-400"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir estación
              </button>
            ) : (
              <div className="space-y-2">
                {hasDownstream && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300/90">
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
                  className="w-full resize-none rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
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
                    className="text-xs text-muted-foreground hover:text-foreground"
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
