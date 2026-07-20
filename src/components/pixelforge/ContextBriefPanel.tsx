"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  BadgeCheck,
  CircleDashed,
  Lightbulb,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TriangleAlert,
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
import type { BriefItem, ContextBrief } from "@/lib/pixelforge/schemas/analyze-context";

interface Props {
  projectId: string;
  artifactStatus: PixelforgeArtifactStatus;
  brief: ContextBrief | null;
  sealedInfo?: { byName: string | null; at: string | null };
  /** Corrida IA más reciente asociada al draft actual — habilita los botones de decisión (👍/👎). */
  lastRunId?: string | null;
}

type BriefColumnKey = "confirmados" | "inferidos" | "faltantes" | "contradicciones";

const COLUMNS: {
  key: BriefColumnKey;
  title: string;
  icon: typeof BadgeCheck;
  iconClass: string;
}[] = [
  // Glifos fijos del módulo (docs/pixelforge/product-dna.md § Iconografía):
  // Confirmado=BadgeCheck · Inferido=Lightbulb · Faltante=CircleDashed ·
  // Contradicción=TriangleAlert. Color: éxito/neutro/aviso/error — el cobre
  // (accent) se reserva a actividad, no a categorías estáticas.
  { key: "confirmados", title: "Confirmados", icon: BadgeCheck, iconClass: "text-pfx-success" },
  { key: "inferidos", title: "Inferidos", icon: Lightbulb, iconClass: "text-pfx-text-muted" },
  { key: "faltantes", title: "Faltantes", icon: CircleDashed, iconClass: "text-pfx-warning" },
  {
    key: "contradicciones",
    title: "Contradicciones",
    icon: TriangleAlert,
    iconClass: "text-pfx-error",
  },
];

const CONFIDENCE_STYLES: Record<BriefItem["confianza"], string> = {
  alta: "bg-[hsl(var(--pfx-success)/0.12)] text-pfx-success",
  media: "bg-[hsl(var(--pfx-warning)/0.12)] text-pfx-warning",
  baja: "bg-[hsl(var(--pfx-border)/0.4)] text-pfx-text-muted",
};

const CONFIDENCE_LABEL: Record<BriefItem["confianza"], string> = {
  alta: "Confianza alta",
  media: "Confianza media",
  baja: "Confianza baja",
};

/** Chip técnico (mono, DNA: "chips técnicos y números" → font-forge-mono). */
const CHIP_CLASS = "rounded px-1.5 py-0.5 font-forge-mono text-[10px] font-medium";

/** Clona el brief completo y aplica `mutate` sobre la copia — nunca se manda un parche parcial al backend. */
function cloneBrief(brief: ContextBrief): ContextBrief {
  return JSON.parse(JSON.stringify(brief)) as ContextBrief;
}

/**
 * Materialidad de las planchas del brief según el status del artifact
 * (docs/pixelforge/product-dna.md § Estados canónicos). `forging` se reserva
 * a la plancha dedicada de progreso (`isAnalyzing`, más abajo) para no
 * duplicar la señal de "trabajándose" en cada columna simultáneamente.
 */
function zoneStateForArtifact(status: PixelforgeArtifactStatus): ForgeState {
  if (status === "sealed") return "sealed";
  if (status === "invalidated") return "invalidated";
  return "draft";
}

/**
 * Panel operativo del Context Brief (estación Contexto, F2 / reskin PF-X2 T1):
 * dispara el análisis IA, muestra el resultado en 4 columnas (planchas), permite
 * editar/descartar ítems del borrador y da feedback sobre la corrida. El
 * sellado en sí vive en `SealBar` (componente hermano); acá solo se refleja la
 * materialidad (`ForgeZone` sellado + `ForgeStamp`) una vez que el artifact ya
 * está sellado, igual que `VisualDnaPanel`.
 */
export function ContextBriefPanel({ projectId, artifactStatus, brief, sealedInfo, lastRunId }: Props) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [reanalyzeConfirming, setReanalyzeConfirming] = useState(false);
  const [editing, setEditing] = useState<{ column: BriefColumnKey; index: number } | null>(null);
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
      toast.success("Context Brief generado");
      setRunId(null);
      router.refresh();
    } else if (run.status === "failed") {
      handledRunRef.current = runId;
      const msg = run.error ?? "No se pudo generar el Context Brief";
      setFailureMessage(msg);
      toast.error(msg);
    }
  }, [run, runId, router]);

  const editable = artifactStatus !== "sealed";
  const isAnalyzing = starting || (!!runId && handledRunRef.current !== runId);
  const zoneState = zoneStateForArtifact(artifactStatus);

  const startAnalysis = async () => {
    setStarting(true);
    setFailureMessage(null);
    setReanalyzeConfirming(false);
    handledRunRef.current = null;
    try {
      const res = await fetch("/api/pixelforge/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, operation: "analyze_context" }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? "No se pudo iniciar el análisis";
        setFailureMessage(msg);
        toast.error(msg);
        return;
      }
      // El POST siempre responde `{ runId, status: "running" }` en éxito — el
      // contrato es async (fire-and-forget, ver docstring de la ruta): el
      // resultado real (succeeded/failed) llega por el poller de arriba
      // (`usePixelforgeRun`), nunca en esta misma respuesta.
      setRunId(json.runId ?? null);
    } catch {
      const msg = "No se pudo iniciar el análisis";
      setFailureMessage(msg);
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const persistDraft = async (draft: ContextBrief) => {
    const r = await updateArtifactDraftAction({ projectId, kind: "context_brief", draft });
    if (!r.success) {
      toast.error(r.error ?? "No se pudo guardar el borrador");
      return false;
    }
    toast.success("Borrador actualizado");
    router.refresh();
    return true;
  };

  const startEdit = (column: BriefColumnKey, index: number, item: BriefItem) => {
    setEditing({ column, index });
    setEditText(item.detalle);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditText("");
  };

  const saveEdit = async () => {
    if (!editing || !brief || savingEdit) return;
    setSavingEdit(true);
    const clone = cloneBrief(brief);
    clone[editing.column][editing.index].detalle = editText;
    const ok = await persistDraft(clone);
    setSavingEdit(false);
    if (ok) cancelEdit();
  };

  const discardItem = async (column: BriefColumnKey, index: number) => {
    if (!brief) return;
    const clone = cloneBrief(brief);
    clone[column].splice(index, 1);
    await persistDraft(clone);
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

  return (
    <div className="space-y-4">
      {artifactStatus === "invalidated" && (
        <ForgeZone state="invalidated" className="p-3">
          <div className="flex items-start gap-2 text-xs text-pfx-warning">
            <RotateCcw className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            Este brief quedó invalidado por la reapertura de una estación anterior. Revísalo y
            vuelve a sellar.
          </div>
        </ForgeZone>
      )}

      {isAnalyzing && (
        <ForgeZone state="forging" variant="elevated" className="p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-pfx-accent" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm text-pfx-text">{run?.currentStep ?? "Analizando contexto…"}</p>
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

      {!isAnalyzing && failureMessage && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.08)] px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-pfx-warning" aria-hidden="true" />
            <p className="text-xs text-pfx-warning">{failureMessage}</p>
          </div>
          <button
            type="button"
            onClick={startAnalysis}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.1)] px-3 py-1.5 text-xs font-medium text-pfx-warning transition-colors hover:bg-[hsl(var(--pfx-warning)/0.2)]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      )}

      {!brief ? (
        !isAnalyzing && (
          <ForgeZone variant="elevated" state="draft" className="px-6 py-16 text-center">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-pfx-accent" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-pfx-text">
                Todavía no hay un Context Brief para este proyecto
              </p>
              <p className="mt-1 text-xs text-pfx-text-muted">
                La IA analiza la descarga mental y las fuentes para armar un brief de 4 columnas.
              </p>
            </div>
            <button
              type="button"
              onClick={startAnalysis}
              className="mx-auto mt-4 flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Analizar contexto
            </button>
          </ForgeZone>
        )
      ) : (
        <div className="space-y-4">
          <ForgeZone state={zoneState} variant="elevated" className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="min-w-[200px] flex-1 text-sm text-pfx-text">{brief.resumen}</p>

              {editable && !isAnalyzing ? (
                <div className="flex-shrink-0">
                  {!reanalyzeConfirming ? (
                    <button
                      type="button"
                      onClick={() => setReanalyzeConfirming(true)}
                      className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-3 py-1.5 text-xs font-medium text-pfx-text-muted transition-colors hover:text-pfx-text"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Re-analizar
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-pfx-warning">
                        Esto reemplaza el borrador actual
                      </span>
                      <button
                        type="button"
                        onClick={startAnalysis}
                        className="rounded-[var(--pfx-radius)] bg-pfx-warning px-3 py-1.5 text-xs font-medium text-pfx-canvas transition-colors hover:opacity-90"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setReanalyzeConfirming(false)}
                        className="text-xs text-pfx-text-muted hover:text-pfx-text"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                artifactStatus === "sealed" &&
                sealedInfo?.at && (
                  <div className="flex-shrink-0">
                    <ForgeStamp sealedAt={sealedInfo.at} />
                  </div>
                )
              )}
            </div>
          </ForgeZone>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => (
              <ForgeZone key={col.key} state={zoneState} className="p-4">
                <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
                  <col.icon className={`h-4 w-4 ${col.iconClass}`} aria-hidden="true" />
                  {col.title}
                  <span className="ml-auto font-forge-mono text-xs text-pfx-text-muted">
                    {brief[col.key].length}
                  </span>
                </div>

                {brief[col.key].length === 0 ? (
                  <p className="text-xs text-pfx-text-muted/60">Sin ítems</p>
                ) : (
                  <ul className="flex flex-col">
                    {brief[col.key].map((item, index) => {
                      const isEditingThis =
                        editing?.column === col.key && editing.index === index;
                      return (
                        <li key={`${col.key}-${index}`}>
                          {index > 0 && <ForgeSeam className="my-3" />}
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-medium text-pfx-text">
                              {item.titulo}
                            </span>
                            {editable && !isEditingThis && (
                              <div className="flex flex-shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  aria-label={`Editar ${item.titulo}`}
                                  onClick={() => startEdit(col.key, index, item)}
                                  className="text-pfx-text-muted transition-colors hover:text-pfx-accent"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Descartar ${item.titulo}`}
                                  onClick={() => discardItem(col.key, index)}
                                  className="text-pfx-text-muted transition-colors hover:text-pfx-error"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            )}
                          </div>

                          {isEditingThis ? (
                            <div className="mt-1.5 space-y-1.5">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows={3}
                                className="w-full resize-none rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-2 py-1.5 text-xs text-pfx-text focus:outline-none focus:ring-2 focus:ring-pfx-accent"
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
                            <p className="mt-1 whitespace-pre-wrap text-xs text-pfx-text-muted">
                              {item.detalle}
                            </p>
                          )}

                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <span className={`${CHIP_CLASS} ${CONFIDENCE_STYLES[item.confianza]}`}>
                              {CONFIDENCE_LABEL[item.confianza]}
                            </span>
                            {item.evidencias.length > 0 && (
                              <details className="text-[11px]">
                                <summary className="cursor-pointer text-pfx-text-muted hover:text-pfx-text">
                                  Evidencias ({item.evidencias.length})
                                </summary>
                                <ul className="mt-1 space-y-1">
                                  {item.evidencias.map((ev, evIndex) => (
                                    <li key={evIndex} className="flex flex-col gap-0.5">
                                      <span className="w-fit rounded bg-[hsl(var(--pfx-border)/0.4)] px-1 py-0.5 font-forge-mono text-[10px] text-pfx-text-muted">
                                        {ev.sourceRef}
                                      </span>
                                      <span className="italic text-pfx-text-muted/80">
                                        &ldquo;{ev.cita}&rdquo;
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ForgeZone>
            ))}
          </div>

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

          {sealedInfo?.byName && artifactStatus === "sealed" && (
            <p className="font-forge-mono text-[11px] text-pfx-text-muted/60">
              Sellado por {sealedInfo.byName}
              {sealedInfo.at ? ` · ${new Date(sealedInfo.at).toLocaleDateString("es-MX")}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
