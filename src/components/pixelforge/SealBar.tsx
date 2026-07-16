"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Loader2, Lock, RotateCcw } from "lucide-react";
import {
  sealContextBriefAction,
  reopenContextBriefAction,
} from "@/app/(admin)/proyectos/pixelforge/actions";
import type { PixelforgeArtifactStatus } from "@/lib/pixelforge/types";

interface Props {
  projectId: string;
  artifactStatus: PixelforgeArtifactStatus;
  sealedByName?: string | null;
  sealedAt?: string | null;
  canSeal: boolean;
  /** true si reabrir invalidará artefactos posteriores ya sellados. */
  downstreamWarning?: boolean;
}

const MIN_REASON_LENGTH = 5;

/**
 * Barra de sellado/reapertura del Context Brief (F2, único kind operativo —
 * F3+ generaliza a otros kinds). Calco visual/UX de ApproveBar +
 * SealedStationView, pero llama directo las actions de context_brief.
 */
export function SealBar({
  projectId,
  artifactStatus,
  sealedByName,
  sealedAt,
  canSeal,
  downstreamWarning,
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const isSealed = artifactStatus === "sealed";

  const handleSeal = async () => {
    if (!canSeal || busy) return;
    setBusy(true);
    const r = await sealContextBriefAction({ projectId });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "No se pudo sellar el Context Brief");
      return;
    }
    toast.success("Context Brief sellado");
    setConfirming(false);
    router.refresh();
  };

  const handleReopen = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH || busy) return;
    setBusy(true);
    const r = await reopenContextBriefAction({ projectId, reason: trimmed });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "No se pudo reabrir el Context Brief");
      return;
    }
    toast.success("Context Brief reabierto");
    setReopening(false);
    setReason("");
    router.refresh();
  };

  if (isSealed) {
    return (
      <div className="rounded-xl border border-cyan-500/20 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyan-400" />
            <span>
              Sellado por {sealedByName ?? "alguien más"}
              {sealedAt && (
                <span className="ml-1 text-xs text-muted-foreground">
                  · {formatDistanceToNow(new Date(sealedAt), { addSuffix: true, locale: es })}
                </span>
              )}
            </span>
          </div>
          {!reopening && (
            <button
              type="button"
              onClick={() => setReopening(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-amber-400/40 hover:text-amber-400"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reabrir
            </button>
          )}
        </div>

        {reopening && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            {downstreamWarning && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300/90">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                Reabrir invalidará los artefactos posteriores sellados.
              </div>
            )}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Explica por qué reabres (mínimo 5 caracteres)…"
              className="w-full resize-none rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReopen}
                disabled={reason.trim().length < MIN_REASON_LENGTH || busy}
                className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
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
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {!confirming ? (
        <div className="flex flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!canSeal}
            title={!canSeal ? "Genera o edita un borrador primero" : undefined}
            className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
          >
            <Lock className="h-4 w-4" />
            Sellar Context Brief
          </button>
          {!canSeal && (
            <span className="text-[11px] text-muted-foreground/70">
              Genera o edita un borrador primero
            </span>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Al sellar, el Context Brief queda congelado. Podrás reabrirlo después, pero quedará
            registrado.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSeal}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Confirmar sello
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
