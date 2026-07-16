"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  updateContextBriefDraftAction,
  setRunDecisionAction,
} from "@/app/(admin)/proyectos/pixelforge/actions";
import { usePixelforgeRun } from "@/hooks/pixelforge/use-pixelforge-run";
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
  icon: typeof CheckCircle2;
  iconClass: string;
}[] = [
  { key: "confirmados", title: "Confirmados", icon: CheckCircle2, iconClass: "text-cyan-400" },
  { key: "inferidos", title: "Inferidos", icon: Lightbulb, iconClass: "text-amber-400/80" },
  { key: "faltantes", title: "Faltantes", icon: AlertCircle, iconClass: "text-orange-400" },
  { key: "contradicciones", title: "Contradicciones", icon: XCircle, iconClass: "text-red-400/80" },
];

const CONFIDENCE_STYLES: Record<BriefItem["confianza"], string> = {
  alta: "bg-lime-500/10 text-lime-700 dark:text-lime-300",
  media: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  baja: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
};

const CONFIDENCE_LABEL: Record<BriefItem["confianza"], string> = {
  alta: "Confianza alta",
  media: "Confianza media",
  baja: "Confianza baja",
};

const FAILURE_MESSAGES: Record<string, string> = {
  refusal: "El modelo rechazó la solicitud",
  max_tokens: "La salida excedió el límite",
  schema_too_complex: "El esquema de salida es demasiado complejo para el proveedor",
  domain_validation: "La salida no pasó las reglas de dominio",
  provider_error: "Hubo un error del proveedor de IA",
  timeout: "La solicitud tardó demasiado (timeout)",
};

/** Clona el brief completo y aplica `mutate` sobre la copia — nunca se manda un parche parcial al backend. */
function cloneBrief(brief: ContextBrief): ContextBrief {
  return JSON.parse(JSON.stringify(brief)) as ContextBrief;
}

/**
 * Panel operativo del Context Brief (estación Contexto, F2): dispara el
 * análisis IA, muestra el resultado en 4 columnas, permite editar/descartar
 * ítems del borrador y da feedback sobre la corrida. El sellado en sí vive en
 * `SealBar` (componente hermano).
 */
export function ContextBriefPanel({ projectId, artifactStatus, brief, sealedInfo, lastRunId }: Props) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [failureKind, setFailureKind] = useState<string | null>(null);
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

  const startAnalysis = async () => {
    setStarting(true);
    setFailureMessage(null);
    setFailureKind(null);
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
      setRunId(json.runId ?? null);
      if (json.status === "succeeded") {
        handledRunRef.current = json.runId ?? null;
        toast.success("Context Brief generado");
        router.refresh();
      } else if (json.status === "failed") {
        handledRunRef.current = json.runId ?? null;
        setFailureKind(json.failure ?? null);
        const msg = json.error ?? "No se pudo generar el Context Brief";
        setFailureMessage(msg);
        toast.error(msg);
      }
    } catch {
      const msg = "No se pudo iniciar el análisis";
      setFailureMessage(msg);
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const persistDraft = async (draft: ContextBrief) => {
    const r = await updateContextBriefDraftAction({ projectId, draft });
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
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          Este brief quedó invalidado por la reapertura de una estación anterior. Revísalo y
          vuelve a sellar.
        </div>
      )}

      {isAnalyzing && (
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-card p-5">
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-cyan-400" />
          <div className="flex-1">
            <p className="text-sm text-foreground">{run?.currentStep ?? "Analizando contexto…"}</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all"
                style={{ width: `${Math.max(5, run?.progress ?? 5)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {!isAnalyzing && failureMessage && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {failureKind && FAILURE_MESSAGES[failureKind]
                ? `${FAILURE_MESSAGES[failureKind]}: ${failureMessage}`
                : failureMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={startAnalysis}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-500/20"
          >
            <RefreshCw className="h-3 w-3" />
            Reintentar
          </button>
        </div>
      )}

      {!brief ? (
        !isAnalyzing && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
            <Sparkles className="h-6 w-6 text-cyan-400" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Todavía no hay un Context Brief para este proyecto
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                La IA analiza la descarga mental y las fuentes para armar un brief de 4 columnas.
              </p>
            </div>
            <button
              type="button"
              onClick={startAnalysis}
              className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400"
            >
              <Sparkles className="h-4 w-4" />
              Analizar contexto
            </button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-foreground/90">{brief.resumen}</p>
            {editable && !isAnalyzing && (
              <div className="flex-shrink-0">
                {!reanalyzeConfirming ? (
                  <button
                    type="button"
                    onClick={() => setReanalyzeConfirming(true)}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Re-analizar
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                      Esto reemplaza el borrador actual
                    </span>
                    <button
                      type="button"
                      onClick={startAnalysis}
                      className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-amber-400"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setReanalyzeConfirming(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.key} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <col.icon className={`h-4 w-4 ${col.iconClass}`} />
                  {col.title}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {brief[col.key].length}
                  </span>
                </div>

                {brief[col.key].length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">Sin ítems</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {brief[col.key].map((item, index) => {
                      const isEditingThis =
                        editing?.column === col.key && editing.index === index;
                      return (
                        <li
                          key={`${col.key}-${index}`}
                          className="rounded-md border border-border/60 bg-secondary/20 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-medium text-foreground">
                              {item.titulo}
                            </span>
                            {editable && !isEditingThis && (
                              <div className="flex flex-shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  aria-label={`Editar ${item.titulo}`}
                                  onClick={() => startEdit(col.key, index, item)}
                                  className="text-muted-foreground transition-colors hover:text-cyan-400"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Descartar ${item.titulo}`}
                                  onClick={() => discardItem(col.key, index)}
                                  className="text-muted-foreground transition-colors hover:text-red-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
                                className="w-full resize-none rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
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
                            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                              {item.detalle}
                            </p>
                          )}

                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CONFIDENCE_STYLES[item.confianza]}`}
                            >
                              {CONFIDENCE_LABEL[item.confianza]}
                            </span>
                            {item.evidencias.length > 0 && (
                              <details className="text-[11px]">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  Evidencias ({item.evidencias.length})
                                </summary>
                                <ul className="mt-1 space-y-1">
                                  {item.evidencias.map((ev, evIndex) => (
                                    <li key={evIndex} className="flex flex-col gap-0.5">
                                      <span className="w-fit rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                                        {ev.sourceRef}
                                      </span>
                                      <span className="italic text-muted-foreground/80">
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
              </div>
            ))}
          </div>

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

          {sealedInfo?.byName && artifactStatus === "sealed" && (
            <p className="text-[11px] text-muted-foreground/60">
              Sellado por {sealedInfo.byName}
              {sealedInfo.at ? ` · ${new Date(sealedInfo.at).toLocaleDateString("es-MX")}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
