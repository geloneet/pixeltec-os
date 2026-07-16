"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Loader2,
  Palette,
  Pencil,
  RefreshCw,
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

const CHIP_CLASS =
  "rounded-full bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground";

/** Clona el Visual DNA completo y aplica la edición sobre la copia — nunca se manda un parche parcial al backend. */
function cloneDna(dna: VisualDna): VisualDna {
  return JSON.parse(JSON.stringify(dna)) as VisualDna;
}

/**
 * Panel operativo del Visual DNA (estación Visual, F4): dispara
 * `synthesize_visual_dna`, muestra el resultado en secciones (dirección
 * general, paleta, tipografía, espaciado, motivos visuales, anti-patrones,
 * influencias) y permite editar la dirección general del borrador. Calco
 * estructural de `LandingDnaPanel` (F3) — el sellado en sí vive en `SealBar`
 * (componente hermano). A diferencia de `LandingDnaPanel`, la compuerta tiene
 * DOS condiciones (estrategia sellada Y al menos una referencia analizada),
 * ambas reflejadas en el mensaje del estado vacío.
 */
export function VisualDnaPanel({
  projectId,
  artifactStatus,
  dna,
  strategySealed,
  analyzedReferenceCount,
  references,
  lastRunId,
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
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          Este Visual DNA quedó invalidado por reapertura de una estación anterior. Re-genéralo o
          revísalo y vuelve a sellar.
        </div>
      )}

      {isGenerating && (
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-card p-5">
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-cyan-400" />
          <div className="flex-1">
            <p className="text-sm text-foreground">{run?.currentStep ?? "Sintetizando Visual DNA…"}</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all"
                style={{ width: `${Math.max(5, run?.progress ?? 5)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {!isGenerating && failureMessage && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-300">{failureMessage}</p>
          </div>
          <button
            type="button"
            onClick={startGeneration}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-500/20"
          >
            <RefreshCw className="h-3 w-3" />
            Reintentar
          </button>
        </div>
      )}

      {!dna ? (
        !isGenerating && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
            <Sparkles className="h-6 w-6 text-cyan-400" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Todavía no hay un Visual DNA para este proyecto
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{emptyStateHint}</p>
            </div>
            <button
              type="button"
              onClick={startGeneration}
              disabled={!canSynthesize}
              title={!canSynthesize ? emptyStateHint : undefined}
              className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" />
              Sintetizar Visual DNA
            </button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-cyan-500/20 bg-card p-4">
            <div className="min-w-[200px] flex-1">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                Dirección general
                {editable && !editingDireccion && (
                  <button
                    type="button"
                    aria-label="Editar dirección general"
                    onClick={startEditDireccion}
                    className="text-muted-foreground transition-colors hover:text-cyan-400"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {editingDireccion ? (
                <div className="space-y-1.5">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={savingEdit || editText.trim().length === 0}
                      className="rounded-md bg-cyan-500 px-2.5 py-1 text-[11px] font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-base font-semibold text-foreground">{dna.direccionGeneral}</p>
              )}
            </div>

            {editable && !isGenerating && (
              <div className="flex-shrink-0">
                {!regenerateConfirming ? (
                  <button
                    type="button"
                    onClick={() => setRegenerateConfirming(true)}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Re-generar
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                      Esto reemplaza el borrador actual
                    </span>
                    <button
                      type="button"
                      onClick={startGeneration}
                      className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-amber-400"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegenerateConfirming(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Palette className="h-4 w-4 text-cyan-400" />
                Paleta
              </div>
              <p className="text-xs text-muted-foreground">{dna.paleta.estrategia}</p>
              <span
                className={`mt-2 inline-block w-fit rounded px-1.5 py-0.5 text-[10px] font-medium ${CHIP_CLASS}`}
              >
                {CONTRASTE_LABEL[dna.paleta.contraste]}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <TypeIcon className="h-4 w-4 text-cyan-400" />
                Tipografía
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">Títulos</p>
              <p className="text-xs text-foreground">{dna.tipografia.caracterTitulos}</p>
              <p className="mt-2 text-[11px] font-medium text-muted-foreground">Cuerpo</p>
              <p className="text-xs text-foreground">{dna.tipografia.caracterCuerpo}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Ruler className="h-4 w-4 text-cyan-400" />
              Espaciado
            </div>
            <span className={CHIP_CLASS}>{ESPACIADO_LABEL[dna.espaciado]}</span>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Shapes className="h-4 w-4 text-cyan-400" />
              Motivos visuales
            </div>
            <div className="flex flex-wrap gap-1.5">
              {dna.motivosVisuales.map((motivo, i) => (
                <span key={i} className={CHIP_CLASS}>
                  {motivo}
                </span>
              ))}
            </div>
          </div>

          {dna.antiPatrones.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-card p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Ban className="h-4 w-4 text-amber-400" />
                Anti-patrones (evitar)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dna.antiPatrones.map((ap, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300"
                  >
                    {ap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {dna.influencias.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Users className="h-4 w-4 text-cyan-400" />
                Influencias
              </div>
              <ul className="flex flex-col gap-3">
                {dna.influencias.map((inf, i) => (
                  <li key={i} className="rounded-md border border-border/60 bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {referenceLabel(inf.referenceId)}
                      </span>
                      <span className={CHIP_CLASS}>{PESO_LABEL[inf.peso]}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{inf.queTomar}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lastRunId && artifactStatus !== "sealed" && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              {decisionGiven ? (
                <p className="text-xs text-muted-foreground">Gracias por el feedback</p>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">
                    ¿Te sirvió este análisis?
                  </span>
                  <button
                    type="button"
                    onClick={() => submitDecision("accepted")}
                    disabled={decisionBusy}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:border-lime-400/40 hover:text-lime-500 disabled:opacity-40"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    Útil
                  </button>
                  <button
                    type="button"
                    onClick={() => submitDecision("rejected")}
                    disabled={decisionBusy}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:border-red-400/40 hover:text-red-400 disabled:opacity-40"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    No útil
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
