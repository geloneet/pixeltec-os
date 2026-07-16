"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Loader2,
  Megaphone,
  MessageSquareQuote,
  Pencil,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import {
  updateArtifactDraftAction,
  setRunDecisionAction,
} from "@/app/(admin)/proyectos/pixelforge/actions";
import { usePixelforgeRun } from "@/hooks/pixelforge/use-pixelforge-run";
import type { PixelforgeArtifactStatus } from "@/lib/pixelforge/types";
import type { LandingDna } from "@/lib/pixelforge/schemas/generate-strategy";

interface Props {
  projectId: string;
  artifactStatus: PixelforgeArtifactStatus;
  dna: LandingDna | null;
  /** true si el Context Brief está sellado — habilita generar la estrategia. */
  contextSealed: boolean;
  /** Corrida IA más reciente asociada al draft actual — habilita los botones de decisión (👍/👎). */
  lastRunId?: string | null;
}

const CTA_INTENT_LABEL: Record<LandingDna["llamadosAccion"][number]["intencion"], string> = {
  contacto: "Contacto",
  cotizacion: "Cotización",
  compra: "Compra",
  registro: "Registro",
  descarga: "Descarga",
  agenda: "Agenda",
};

type EditTarget = "propuestaValor" | { mensajeIndex: number };

const CHIP_CLASS =
  "rounded-full bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground";

/** Clona el Landing DNA completo y aplica la edición sobre la copia — nunca se manda un parche parcial al backend. */
function cloneDna(dna: LandingDna): LandingDna {
  return JSON.parse(JSON.stringify(dna)) as LandingDna;
}

/**
 * Panel operativo del Landing DNA (estación Estrategia, F3): dispara
 * `generate_strategy`, muestra el resultado en secciones (propuesta de
 * valor, audiencia, tono, mensajes clave, llamados a acción, evidencias) y
 * permite editar la propuesta de valor y los mensajes clave del borrador.
 * Calco estructural de `ContextBriefPanel` (F2) — el sellado en sí vive en
 * `SealBar` (componente hermano).
 */
export function LandingDnaPanel({ projectId, artifactStatus, dna, contextSealed, lastRunId }: Props) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [regenerateConfirming, setRegenerateConfirming] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);
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
      toast.success("Landing DNA generado");
      setRunId(null);
      router.refresh();
    } else if (run.status === "failed") {
      handledRunRef.current = runId;
      const msg = run.error ?? "No se pudo generar el Landing DNA";
      setFailureMessage(msg);
      toast.error(msg);
    }
  }, [run, runId, router]);

  const editable = artifactStatus !== "sealed";
  const isGenerating = starting || (!!runId && handledRunRef.current !== runId);

  const startGeneration = async () => {
    setStarting(true);
    setFailureMessage(null);
    setRegenerateConfirming(false);
    handledRunRef.current = null;
    try {
      const res = await fetch("/api/pixelforge/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, operation: "generate_strategy" }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? "No se pudo iniciar la generación";
        setFailureMessage(msg);
        toast.error(msg);
        return;
      }
      // El POST siempre responde `{ runId, status: "running" }` en éxito — el
      // contrato es async (fire-and-forget): el resultado real
      // (succeeded/failed) llega por el poller de arriba (`usePixelforgeRun`).
      setRunId(json.runId ?? null);
    } catch {
      const msg = "No se pudo iniciar la generación";
      setFailureMessage(msg);
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const persistDraft = async (draft: LandingDna) => {
    const r = await updateArtifactDraftAction({ projectId, kind: "landing_dna", draft });
    if (!r.success) {
      toast.error(r.error ?? "No se pudo guardar el borrador");
      return false;
    }
    toast.success("Borrador actualizado");
    router.refresh();
    return true;
  };

  const startEditPropuesta = () => {
    if (!dna) return;
    setEditing("propuestaValor");
    setEditText(dna.propuestaValor);
  };

  const startEditMensaje = (index: number) => {
    if (!dna) return;
    setEditing({ mensajeIndex: index });
    setEditText(dna.mensajesClave[index].mensaje);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditText("");
  };

  const saveEdit = async () => {
    if (!editing || !dna || savingEdit) return;
    setSavingEdit(true);
    const clone = cloneDna(dna);
    if (editing === "propuestaValor") {
      clone.propuestaValor = editText;
    } else {
      clone.mensajesClave[editing.mensajeIndex].mensaje = editText;
    }
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

  const isEditingPropuesta = editing === "propuestaValor";

  return (
    <div className="space-y-4">
      {artifactStatus === "invalidated" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          Este Landing DNA quedó invalidado por la reapertura del Contexto. Re-genéralo o revísalo
          y vuelve a sellar.
        </div>
      )}

      {isGenerating && (
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-card p-5">
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-cyan-400" />
          <div className="flex-1">
            <p className="text-sm text-foreground">{run?.currentStep ?? "Generando estrategia…"}</p>
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
                Todavía no hay un Landing DNA para este proyecto
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {contextSealed
                  ? "La IA usa el Context Brief sellado para definir la propuesta de valor, la audiencia y el tono de la landing."
                  : "Sella el Contexto para habilitar la estrategia"}
              </p>
            </div>
            <button
              type="button"
              onClick={startGeneration}
              disabled={!contextSealed}
              title={!contextSealed ? "Sella el Contexto para habilitar la estrategia" : undefined}
              className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" />
              Generar estrategia
            </button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-cyan-500/20 bg-card p-4">
            <div className="min-w-[200px] flex-1">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                Propuesta de valor
                {editable && !isEditingPropuesta && (
                  <button
                    type="button"
                    aria-label="Editar propuesta de valor"
                    onClick={startEditPropuesta}
                    className="text-muted-foreground transition-colors hover:text-cyan-400"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {isEditingPropuesta ? (
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
                <p className="text-base font-semibold text-foreground">{dna.propuestaValor}</p>
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
                <Users className="h-4 w-4 text-cyan-400" />
                Audiencia
              </div>
              <p className="text-xs text-muted-foreground">{dna.audiencia.descripcion}</p>

              <div className="mt-3">
                <p className="text-[11px] font-medium text-muted-foreground">Dolores</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {dna.audiencia.dolores.map((dolor, i) => (
                    <span key={i} className={CHIP_CLASS}>
                      {dolor}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-medium text-muted-foreground">Objeciones</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {dna.audiencia.objeciones.map((objecion, i) => (
                    <span key={i} className={CHIP_CLASS}>
                      {objecion}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <MessageSquareQuote className="h-4 w-4 text-cyan-400" />
                Tono
              </div>
              <p className="text-xs text-muted-foreground">{dna.tono.voz}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {dna.tono.atributos.map((atributo, i) => (
                  <span key={i} className={CHIP_CLASS}>
                    {atributo}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
              Mensajes clave
              <span className="ml-auto text-xs text-muted-foreground">
                {dna.mensajesClave.length}
              </span>
            </div>
            <ul className="flex flex-col gap-3">
              {dna.mensajesClave.map((item, index) => {
                const isEditingThis =
                  typeof editing === "object" && editing?.mensajeIndex === index;
                return (
                  <li
                    key={index}
                    className="rounded-md border border-border/60 bg-secondary/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      {isEditingThis ? (
                        <div className="w-full space-y-1.5">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
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
                        <>
                          <p className="text-xs text-foreground">{item.mensaje}</p>
                          {editable && (
                            <button
                              type="button"
                              aria-label={`Editar mensaje clave ${index + 1}`}
                              onClick={() => startEditMensaje(index)}
                              className="flex-shrink-0 text-muted-foreground transition-colors hover:text-cyan-400"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {item.evidencias.length > 0 && (
                      <details className="mt-1.5 text-[11px]">
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
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Megaphone className="h-4 w-4 text-cyan-400" />
              Llamados a acción
            </div>
            <div className="flex flex-wrap gap-2">
              {dna.llamadosAccion.map((cta, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1 text-xs text-foreground"
                >
                  {cta.texto}
                  <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700 dark:text-cyan-300">
                    {CTA_INTENT_LABEL[cta.intencion]}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {dna.evidencias.length > 0 && (
            <details className="rounded-xl border border-border bg-card p-4 text-xs">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Evidencias globales ({dna.evidencias.length})
              </summary>
              <ul className="mt-2 space-y-1.5">
                {dna.evidencias.map((ev, i) => (
                  <li key={i} className="flex flex-col gap-0.5">
                    <span className="w-fit rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {ev.sourceRef}
                    </span>
                    <span className="italic text-muted-foreground/80">&ldquo;{ev.cita}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </details>
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
