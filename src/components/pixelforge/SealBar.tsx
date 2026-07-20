"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Loader2, Lock, RotateCcw } from "lucide-react";
import {
  sealArtifactByKindAction,
  reopenArtifactByKindAction,
} from "@/app/(admin)/proyectos/pixelforge/actions";
import { ForgeZone } from "@/components/pixelforge/forge/ForgeZone";
import { ForgeStamp } from "@/components/pixelforge/forge/ForgeStamp";
import type { OperativeArtifactKind, PixelforgeArtifactStatus } from "@/lib/pixelforge/types";

interface Props {
  projectId: string;
  artifactStatus: PixelforgeArtifactStatus;
  /** Kind del artifact que sella esta barra — determina qué action genérica llamar. */
  kind: OperativeArtifactKind;
  /** Nombre visible del artifact en los textos ("Context Brief", "Landing DNA"). */
  kindLabel: string;
  sealedByName?: string | null;
  sealedAt?: string | null;
  canSeal: boolean;
  /** true si reabrir invalidará artefactos posteriores ya sellados. */
  downstreamWarning?: boolean;
}

const MIN_REASON_LENGTH = 5;

/**
 * Barra de sellado/reapertura genérica por `kind` (F3 generaliza el único
 * kind operativo de F2 — `context_brief` — a cualquier artifact OPERATIVO:
 * `landing_dna` se suma en F3). Llama las actions genéricas por kind
 * (`sealArtifactByKindAction`/`reopenArtifactByKindAction`, F3-T1).
 *
 * Reskin PF-X1 T6: materialidad de forja (`ForgeZone` sellado/draft +
 * `ForgeStamp`) en vez de la tarjeta genérica cyan. Componente COMPARTIDO por
 * las cinco estaciones operativas (contexto, estrategia, visual, direcciones,
 * blueprint) — API y comportamiento (props, actions, textos) IDÉNTICOS al
 * original; el reskin es puramente visual.
 */
export function SealBar({
  projectId,
  artifactStatus,
  kind,
  kindLabel,
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
    const r = await sealArtifactByKindAction({ projectId, kind });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error ?? `No se pudo sellar ${kindLabel}`);
      return;
    }
    toast.success(`${kindLabel} sellado`);
    setConfirming(false);
    router.refresh();
  };

  const handleReopen = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH || busy) return;
    setBusy(true);
    const r = await reopenArtifactByKindAction({ projectId, kind, reason: trimmed });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error ?? `No se pudo reabrir ${kindLabel}`);
      return;
    }
    toast.success(`${kindLabel} reabierto`);
    setReopening(false);
    setReason("");
    router.refresh();
  };

  if (isSealed) {
    return (
      <ForgeZone state="sealed" variant="elevated" className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm text-pfx-text">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-pfx-forge-sealed" aria-hidden="true" />
            <span>
              Sellado por {sealedByName ?? "alguien más"}
              {sealedAt && (
                <span className="ml-1 text-xs text-pfx-text-muted">
                  · {formatDistanceToNow(new Date(sealedAt), { addSuffix: true, locale: es })}
                </span>
              )}
            </span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3">
            {sealedAt && <ForgeStamp sealedAt={sealedAt} />}
            {!reopening && (
              <button
                type="button"
                onClick={() => setReopening(true)}
                className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-3 py-1.5 text-xs font-medium text-pfx-text transition-colors hover:border-pfx-warning/40 hover:text-pfx-warning"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reabrir
              </button>
            )}
          </div>
        </div>

        {reopening && (
          <div className="mt-3 space-y-2 border-t border-pfx-border pt-3">
            {downstreamWarning && (
              <div className="flex items-start gap-2 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.08)] px-3 py-2 text-[11px] text-pfx-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                Reabrir invalidará los artefactos posteriores sellados.
              </div>
            )}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Explica por qué reabres (mínimo 5 caracteres)…"
              className="w-full resize-none rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3 py-2 text-sm text-pfx-text placeholder:text-pfx-text-muted/60 focus:outline-none focus:ring-2 focus:ring-pfx-warning/40"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReopen}
                disabled={reason.trim().length < MIN_REASON_LENGTH || busy}
                className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] bg-pfx-warning px-3 py-1.5 text-xs font-medium text-pfx-canvas transition-colors hover:opacity-90 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Confirmar reapertura
              </button>
              <button
                type="button"
                onClick={() => {
                  setReopening(false);
                  setReason("");
                }}
                className="text-xs text-pfx-text-muted hover:text-pfx-text"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </ForgeZone>
    );
  }

  return (
    <ForgeZone state="draft" variant="elevated" className="p-4">
      {!confirming ? (
        <div className="flex flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!canSeal}
            title={!canSeal ? "Genera o edita un borrador primero" : undefined}
            className="flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Sellar {kindLabel}
          </button>
          {!canSeal && (
            <span className="text-[11px] text-pfx-text-muted/70">
              Genera o edita un borrador primero
            </span>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-pfx-text-muted">
            Al sellar, {kindLabel} queda congelado. Podrás reabrirlo después, pero quedará
            registrado.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSeal}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] bg-pfx-accent px-3 py-1.5 text-xs font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Confirmar sello
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-xs text-pfx-text-muted hover:text-pfx-text"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </ForgeZone>
  );
}
