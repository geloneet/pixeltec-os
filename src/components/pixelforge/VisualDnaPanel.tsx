"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Ban,
  Lock,
  Loader2,
  Palette,
  Pencil,
  RefreshCw,
  RotateCcw,
  Ruler,
  Shapes,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Type as TypeIcon,
  Users,
} from "lucide-react";
import {
  updateArtifactDraftAction,
  setRunDecisionAction,
} from "@/app/(admin)/proyectos/pixelforge/actions";
import { usePixelforgeRun } from "@/hooks/pixelforge/use-pixelforge-run";
import { ForgeZone, type ForgeState } from "@/components/pixelforge/forge/ForgeZone";
import { ForgeSeam } from "@/components/pixelforge/forge/ForgeSeam";
import { ForgeStamp } from "@/components/pixelforge/forge/ForgeStamp";
import type { PixelforgeArtifactStatus } from "@/lib/pixelforge/types";
import type { VisualDna } from "@/lib/pixelforge/schemas/synthesize-visual-dna";

interface Props {
  projectId: string;
  artifactStatus: PixelforgeArtifactStatus;
  dna: VisualDna | null;
  /** true si la Estrategia (Landing DNA) está sellada — habilita sintetizar el Visual DNA. */
  strategySealed: boolean;
  /** Cantidad de referencias visuales con `analysis` presente. */
  analyzedReferenceCount: number;
  /**
   * id→label de las referencias visuales del proyecto — resuelve
   * `influencias[].referenceId` a un nombre legible en la sección de
   * Influencias. `synthesize_visual_dna` solo devuelve el id crudo.
   */
  references?: { id: string; label: string }[];
  /** Corrida IA más reciente asociada al draft actual — habilita los botones de decisión (👍/👎). */
  lastRunId?: string | null;
  /**
   * ISO del sellado (PF-X1 T6) — habilita la `ForgeStamp` en la plancha de
   * "Dirección general" cuando `artifactStatus === "sealed"`. Puramente
   * presentacional: sin este prop el panel simplemente no muestra la estampa
   * (no rompe consumidores existentes).
   */
  sealedAt?: string | null;
}

const CONTRASTE_LABEL: Record<VisualDna["paleta"]["contraste"], string> = {
  suave: "Contraste suave",
  medio: "Contraste medio",
  alto: "Contraste alto",
};

const ESPACIADO_LABEL: Record<VisualDna["espaciado"], string> = {
  compacto: "Compacto",
  equilibrado: "Equilibrado",
  aireado: "Aireado",
};

const PESO_LABEL: Record<VisualDna["influencias"][number]["peso"], string> = {
  baja: "Peso bajo",
  media: "Peso medio",
  alta: "Peso alto",
};

/** Chip técnico (mono, DNA: "chips técnicos y números" → font-forge-mono). */
const CHIP_CLASS =
  "rounded-full bg-[hsl(var(--pfx-border)/0.4)] px-2 py-0.5 font-forge-mono text-[10px] text-pfx-text-muted";

/** Chip de anti-patrón — mismo idiom técnico pero en ámbar (evitar). */
const ANTI_PATTERN_CHIP_CLASS =
  "rounded-full bg-[hsl(var(--pfx-warning)/0.12)] px-2 py-0.5 font-forge-mono text-[10px] text-pfx-warning";

/**
 * Materialidad de las planchas del DNA según el status del artifact
 * (docs/pixelforge/product-dna.md § Estados canónicos). `forging` se reserva
 * a la plancha dedicada de progreso (`isGenerating`, más abajo) para no
 * duplicar la señal de "trabajándose" en cada sección simultáneamente.
 */
function zoneStateForArtifact(status: PixelforgeArtifactStatus): ForgeState {
  if (status === "sealed") return "sealed";
  if (status === "invalidated") return "invalidated";
  return "draft";
}

/** Clona el Visual DNA completo y aplica la edición sobre la copia — nunca se manda un parche parcial al backend. */
function cloneDna(dna: VisualDna): VisualDna {
  return JSON.parse(JSON.stringify(dna)) as VisualDna;
}

/**
 * Panel operativo del Visual DNA (estación Visual, F4 / reskin PF-X1 T6):
 * dispara `synthesize_visual_dna`, muestra el resultado en planchas de banco
 * (dirección general, paleta, tipografía, espaciado, motivos visuales,
 * anti-patrones, influencias) y permite editar la dirección general del
 * borrador. El sellado en sí vive en `SealBar` (componente hermano); acá solo
 * se refleja la materialidad (`ForgeZone` sellado + `ForgeStamp`) una vez que
 * el artifact ya está sellado. A diferencia de `LandingDnaPanel`, la
 * compuerta tiene DOS condiciones (estrategia sellada Y al menos una
 * referencia analizada) — cuando no se cumplen, el estado vacío se muestra
 * con la materialidad `locked` del DNA (el gate se explica sin romper la
 * estación actual, igual que un segmento bloqueado del riel).
 */
export function VisualDnaPanel({
  projectId,
  artifactStatus,
  dna,
  strategySealed,
  analyzedReferenceCount,
  references,
  lastRunId,
  sealedAt,
}: Props) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [regenerateConfirming, setRegenerateConfirming] = useState(false);
  const [editingDireccion, setEditingDireccion] = useState(false);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [decisionGiven, setDecisionGiven] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);

  const { run } = usePixelforgeRun(runId);
  const handledRunRef = useRef<string | null>(null);

  useEffect(() => {
    if (!run || !runId || handledRunRef.current === runId) return;
    if (run.status === "succeeded") {
      handledRunRef.current = runId;
      toast.success("Visual DNA generado");
      setRunId(null);
      router.refresh();
    } else if (run.status === "failed") {
      handledRunRef.current = runId;
      const msg = run.error ?? "No se pudo generar el Visual DNA";
      setFailureMessage(msg);
      toast.error(msg);
    }
  }, [run, runId, router]);

  const editable = artifactStatus !== "sealed";
  const isGenerating = starting || (!!runId && handledRunRef.current !== runId);
  const canSynthesize = strategySealed && analyzedReferenceCount > 0;
  const zoneState = zoneStateForArtifact(artifactStatus);

  const startGeneration = async () => {
    setStarting(true);
    setFailureMessage(null);
    setRegenerateConfirming(false);
    handledRunRef.current = null;
    try {
      const res = await fetch("/api/pixelforge/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, operation: "synthesize_visual_dna" }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? "No se pudo iniciar la síntesis";
        setFailureMessage(msg);
        toast.error(msg);
        return;
      }
      // El POST siempre responde `{ runId, status: "running" }` en éxito — el
      // contrato es async (fire-and-forget): el resultado real
      // (succeeded/failed) llega por el poller de arriba (`usePixelforgeRun`).
      setRunId(json.runId ?? null);
    } catch {
      const msg = "No se pudo iniciar la síntesis";
      setFailureMessage(msg);
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const persistDraft = async (draft: VisualDna) => {
    const r = await updateArtifactDraftAction({ projectId, kind: "visual_dna", draft });
    if (!r.success) {
      toast.error(r.error ?? "No se pudo guardar el borrador");
      return false;
    }
    toast.success("Borrador actualizado");
    router.refresh();
    return true;
  };

  const startEditDireccion = () => {
    if (!dna) return;
    setEditingDireccion(true);
    setEditText(dna.direccionGeneral);
  };

  const cancelEdit = () => {
    setEditingDireccion(false);
    setEditText("");
  };

  const saveEdit = async () => {
    if (!editingDireccion || !dna || savingEdit) return;
    setSavingEdit(true);
    const clone = cloneDna(dna);
    clone.direccionGeneral = editText;
    const ok = await persistDraft(clone);
    setSavingEdit(false);
    if (ok) cancelEdit();
  };

  const submitDecision = async (decision: "accepted" | "rejected") => {
    if (!lastRunId || decisionBusy) return;
    setDecisionBusy(true);
    const r = await setRunDecisionAction({ runId: lastRunId, decision });
    setDecisionBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "No se pudo registrar tu respuesta");
      return;
    }
    setDecisionGiven(true);
  };

  const referenceLabel = (referenceId: string) =>
    references?.find((r) => r.id === referenceId)?.label ?? referenceId;

  const emptyStateHint = !strategySealed
    ? "Sella la Estrategia para habilitar el Visual DNA"
    : analyzedReferenceCount === 0
      ? "Analiza al menos una referencia antes de sintetizar"
      : "La IA usa la Estrategia sellada y las referencias analizadas para definir la dirección visual.";

  return (
    <div className="space-y-4">
      {artifactStatus === "invalidated" && (
        <ForgeZone state="invalidated" className="p-3">
          <div className="flex items-start gap-2 text-xs text-pfx-warning">
            <RotateCcw className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            Este Visual DNA quedó invalidado por reapertura de una estación anterior. Re-genéralo o
            revísalo y vuelve a sellar.
          </div>
        </ForgeZone>
      )}

      {isGenerating && (
        <ForgeZone state="forging" variant="elevated" className="p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-pfx-accent" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm text-pfx-text">{run?.currentStep ?? "Sintetizando Visual DNA…"}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--pfx-border)/0.6)]">
                <div
                  className="h-full rounded-full bg-pfx-accent transition-all"
                  style={{ width: `${Math.max(5, run?.progress ?? 5)}%` }}
                />
              </div>
            </div>
          </div>
        </ForgeZone>
      )}

      {!isGenerating && failureMessage && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.08)] px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-pfx-warning" aria-hidden="true" />
            <p className="text-xs text-pfx-warning">{failureMessage}</p>
          </div>
          <button
            type="button"
            onClick={startGeneration}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.1)] px-3 py-1.5 text-xs font-medium text-pfx-warning transition-colors hover:bg-[hsl(var(--pfx-warning)/0.2)]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      )}

      {!dna ? (
        !isGenerating &&
        (canSynthesize ? (
          <ForgeZone variant="elevated" state="draft" className="px-6 py-16 text-center">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-pfx-accent" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-pfx-text">
                Todavía no hay un Visual DNA para este proyecto
              </p>
              <p className="mt-1 text-xs text-pfx-text-muted">{emptyStateHint}</p>
            </div>
            <button
              type="button"
              onClick={startGeneration}
              className="mx-auto mt-4 flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Sintetizar Visual DNA
            </button>
          </ForgeZone>
        ) : (
          // locked: la síntesis está gateada (estrategia sin sellar o sin
          // referencias analizadas) — el panel explica el gate sin romper la
          // navegación de la estación actual (docs/pixelforge/product-dna.md
          // § Estados canónicos, "locked").
          <ForgeZone variant="elevated" state="locked" className="px-6 py-16 text-center">
            <Lock className="mx-auto mb-3 h-6 w-6 text-pfx-forge-locked" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-pfx-text">
                Todavía no hay un Visual DNA para este proyecto
              </p>
              <p className="mt-1 text-xs text-pfx-text-muted">{emptyStateHint}</p>
            </div>
            <button
              type="button"
              onClick={startGeneration}
              disabled
              title={emptyStateHint}
              className="mx-auto mt-4 flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent opacity-40"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Sintetizar Visual DNA
            </button>
          </ForgeZone>
        ))
      ) : (
        <div className="space-y-4">
          <ForgeZone state={zoneState} variant="elevated" className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-[200px] flex-1">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-pfx-text-muted">
                  <Sparkles className="h-3.5 w-3.5 text-pfx-accent" aria-hidden="true" />
                  Dirección general
                  {editable && !editingDireccion && (
                    <button
                      type="button"
                      aria-label="Editar dirección general"
                      onClick={startEditDireccion}
                      className="text-pfx-text-muted transition-colors hover:text-pfx-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {editingDireccion ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-2 py-1.5 text-sm text-pfx-text focus:outline-none focus:ring-2 focus:ring-pfx-accent"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={savingEdit || editText.trim().length === 0}
                        className="rounded-[var(--pfx-radius)] bg-pfx-accent px-2.5 py-1 text-[11px] font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-[11px] text-pfx-text-muted hover:text-pfx-text"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-base font-semibold text-pfx-text">{dna.direccionGeneral}</p>
                )}
              </div>

              {editable && !isGenerating ? (
                <div className="flex-shrink-0">
                  {!regenerateConfirming ? (
                    <button
                      type="button"
                      onClick={() => setRegenerateConfirming(true)}
                      className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-3 py-1.5 text-xs font-medium text-pfx-text-muted transition-colors hover:text-pfx-text"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Re-generar
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-pfx-warning">
                        Esto reemplaza el borrador actual
                      </span>
                      <button
                        type="button"
                        onClick={startGeneration}
                        className="rounded-[var(--pfx-radius)] bg-pfx-warning px-3 py-1.5 text-xs font-medium text-pfx-canvas transition-colors hover:opacity-90"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegenerateConfirming(false)}
                        className="text-xs text-pfx-text-muted hover:text-pfx-text"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                artifactStatus === "sealed" &&
                sealedAt && (
                  <div className="flex-shrink-0">
                    <ForgeStamp sealedAt={sealedAt} />
                  </div>
                )
              )}
            </div>
          </ForgeZone>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ForgeZone state={zoneState} className="p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
                <Palette className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
                Paleta
              </div>
              <p className="text-xs text-pfx-text-muted">{dna.paleta.estrategia}</p>
              <span className={`mt-2 inline-block w-fit ${CHIP_CLASS}`}>
                {CONTRASTE_LABEL[dna.paleta.contraste]}
              </span>
            </ForgeZone>

            <ForgeZone state={zoneState} className="p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
                <TypeIcon className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
                Tipografía
              </div>
              <p className="text-[11px] font-medium text-pfx-text-muted">Títulos</p>
              <p className="text-xs text-pfx-text">{dna.tipografia.caracterTitulos}</p>
              <p className="mt-2 text-[11px] font-medium text-pfx-text-muted">Cuerpo</p>
              <p className="text-xs text-pfx-text">{dna.tipografia.caracterCuerpo}</p>
            </ForgeZone>
          </div>

          <ForgeZone state={zoneState} className="p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
              <Ruler className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
              Espaciado
            </div>
            <span className={CHIP_CLASS}>{ESPACIADO_LABEL[dna.espaciado]}</span>
          </ForgeZone>

          <ForgeZone state={zoneState} className="p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
              <Shapes className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
              Motivos visuales
            </div>
            <div className="flex flex-wrap gap-1.5">
              {dna.motivosVisuales.map((motivo, i) => (
                <span key={i} className={CHIP_CLASS}>
                  {motivo}
                </span>
              ))}
            </div>
          </ForgeZone>

          {dna.antiPatrones.length > 0 && (
            <ForgeZone state={zoneState} className="p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
                <Ban className="h-4 w-4 text-pfx-warning" aria-hidden="true" />
                Anti-patrones (evitar)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dna.antiPatrones.map((ap, i) => (
                  <span key={i} className={ANTI_PATTERN_CHIP_CLASS}>
                    {ap}
                  </span>
                ))}
              </div>
            </ForgeZone>
          )}

          {dna.influencias.length > 0 && (
            <ForgeZone state={zoneState} className="p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
                <Users className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
                Influencias
              </div>
              <ul className="flex flex-col">
                {dna.influencias.map((inf, i) => (
                  <li key={i}>
                    {i > 0 && <ForgeSeam className="my-3" />}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-pfx-text">
                        {referenceLabel(inf.referenceId)}
                      </span>
                      <span className={CHIP_CLASS}>{PESO_LABEL[inf.peso]}</span>
                    </div>
                    <p className="mt-1 text-xs text-pfx-text-muted">{inf.queTomar}</p>
                  </li>
                ))}
              </ul>
            </ForgeZone>
          )}

          {lastRunId && artifactStatus !== "sealed" && (
            <ForgeZone state="draft" className="p-3">
              <div className="flex items-center gap-3 px-1">
                {decisionGiven ? (
                  <p className="text-xs text-pfx-text-muted">Gracias por el feedback</p>
                ) : (
                  <>
                    <span className="text-xs text-pfx-text-muted">¿Te sirvió este análisis?</span>
                    <button
                      type="button"
                      onClick={() => submitDecision("accepted")}
                      disabled={decisionBusy}
                      className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-2.5 py-1 text-xs text-pfx-text transition-colors hover:border-pfx-success/40 hover:text-pfx-success disabled:opacity-40"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                      Útil
                    </button>
                    <button
                      type="button"
                      onClick={() => submitDecision("rejected")}
                      disabled={decisionBusy}
                      className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-2.5 py-1 text-xs text-pfx-text transition-colors hover:border-pfx-error/40 hover:text-pfx-error disabled:opacity-40"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                      No útil
                    </button>
                  </>
                )}
              </div>
            </ForgeZone>
          )}
        </div>
      )}
    </div>
  );
}
