"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Lock,
  Megaphone,
  MessageSquareQuote,
  Pencil,
  RefreshCw,
  RotateCcw,
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
import { ForgeZone, type ForgeState } from "@/components/pixelforge/forge/ForgeZone";
import { ForgeSeam } from "@/components/pixelforge/forge/ForgeSeam";
import { ForgeStamp } from "@/components/pixelforge/forge/ForgeStamp";
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
  /**
   * ISO del sellado (PF-X2 T2, calco de `VisualDnaPanel`) — habilita la
   * `ForgeStamp` en la plancha de "Propuesta de valor" cuando
   * `artifactStatus === "sealed"`. Puramente presentacional: sin este prop el
   * panel simplemente no muestra la estampa (no rompe consumidores existentes).
   */
  sealedAt?: string | null;
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

/** Chip técnico (mono, DNA: "chips técnicos y números" → font-forge-mono). */
const CHIP_CLASS =
  "rounded-full bg-[hsl(var(--pfx-border)/0.4)] px-2 py-0.5 font-forge-mono text-[10px] text-pfx-text-muted";

/** Clona el Landing DNA completo y aplica la edición sobre la copia — nunca se manda un parche parcial al backend. */
function cloneDna(dna: LandingDna): LandingDna {
  return JSON.parse(JSON.stringify(dna)) as LandingDna;
}

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

/**
 * Panel operativo del Landing DNA (estación Estrategia, F3 / reskin PF-X2 T2):
 * dispara `generate_strategy`, muestra el resultado en planchas de banco
 * (propuesta de valor, audiencia, tono, mensajes clave, llamados a acción,
 * evidencias) y permite editar la propuesta de valor y los mensajes clave del
 * borrador. Calco estructural de `VisualDnaPanel` (F4) — el sellado en sí vive
 * en `SealBar` (componente hermano); acá solo se refleja la materialidad
 * (`ForgeZone` sellado + `ForgeStamp`) una vez que el artifact ya está
 * sellado. A diferencia de `VisualDnaPanel`, la compuerta tiene UNA sola
 * condición (Context Brief sellado, `contextSealed` — ver guard de
 * `generate_strategy` en `src/app/api/pixelforge/runs/route.ts`) — cuando no
 * se cumple, el estado vacío se muestra con la materialidad `locked` del DNA
 * (el gate se explica sin romper la estación actual, igual que un segmento
 * bloqueado del riel).
 */
export function LandingDnaPanel({
  projectId,
  artifactStatus,
  dna,
  contextSealed,
  lastRunId,
  sealedAt,
}: Props) {
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

  const emptyStateHint = !contextSealed
    ? "Sella el Contexto para habilitar la estrategia"
    : "La IA usa el Context Brief sellado para definir la propuesta de valor, la audiencia y el tono de la landing.";

  return (
    <div className="space-y-4">
      {artifactStatus === "invalidated" && (
        <ForgeZone state="invalidated" className="p-3">
          <div className="flex items-start gap-2 text-xs text-pfx-warning">
            <RotateCcw className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            Este Landing DNA quedó invalidado por la reapertura del Contexto. Re-genéralo o revísalo
            y vuelve a sellar.
          </div>
        </ForgeZone>
      )}

      {isGenerating && (
        <ForgeZone state="forging" variant="elevated" className="p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-pfx-accent" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm text-pfx-text">{run?.currentStep ?? "Generando estrategia…"}</p>
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
        (contextSealed ? (
          <ForgeZone variant="elevated" state="draft" className="px-6 py-16 text-center">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-pfx-accent" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-pfx-text">
                Todavía no hay un Landing DNA para este proyecto
              </p>
              <p className="mt-1 text-xs text-pfx-text-muted">{emptyStateHint}</p>
            </div>
            <button
              type="button"
              onClick={startGeneration}
              className="mx-auto mt-4 flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Generar estrategia
            </button>
          </ForgeZone>
        ) : (
          // locked: la generación está gateada (Contexto sin sellar) — el
          // panel explica el gate sin romper la navegación de la estación
          // actual (docs/pixelforge/product-dna.md § Estados canónicos,
          // "locked", uso 2).
          <ForgeZone variant="elevated" state="locked" className="px-6 py-16 text-center">
            <Lock className="mx-auto mb-3 h-6 w-6 text-pfx-forge-locked" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-pfx-text">
                Todavía no hay un Landing DNA para este proyecto
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
              Generar estrategia
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
                  Propuesta de valor
                  {editable && !isEditingPropuesta && (
                    <button
                      type="button"
                      aria-label="Editar propuesta de valor"
                      onClick={startEditPropuesta}
                      className="text-pfx-text-muted transition-colors hover:text-pfx-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {isEditingPropuesta ? (
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
                  <p className="text-base font-semibold text-pfx-text">{dna.propuestaValor}</p>
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
                <Users className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
                Audiencia
              </div>
              <p className="text-xs text-pfx-text-muted">{dna.audiencia.descripcion}</p>

              <div className="mt-3">
                <p className="text-[11px] font-medium text-pfx-text-muted">Dolores</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {dna.audiencia.dolores.map((dolor, i) => (
                    <span key={i} className={CHIP_CLASS}>
                      {dolor}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-medium text-pfx-text-muted">Objeciones</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {dna.audiencia.objeciones.map((objecion, i) => (
                    <span key={i} className={CHIP_CLASS}>
                      {objecion}
                    </span>
                  ))}
                </div>
              </div>
            </ForgeZone>

            <ForgeZone state={zoneState} className="p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
                <MessageSquareQuote className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
                Tono
              </div>
              <p className="text-xs text-pfx-text-muted">{dna.tono.voz}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {dna.tono.atributos.map((atributo, i) => (
                  <span key={i} className={CHIP_CLASS}>
                    {atributo}
                  </span>
                ))}
              </div>
            </ForgeZone>
          </div>

          <ForgeZone state={zoneState} className="p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
              Mensajes clave
              <span className="ml-auto font-forge-mono text-xs text-pfx-text-muted">
                {dna.mensajesClave.length}
              </span>
            </div>
            <ul className="flex flex-col">
              {dna.mensajesClave.map((item, index) => {
                const isEditingThis =
                  typeof editing === "object" && editing?.mensajeIndex === index;
                return (
                  <li key={index}>
                    {index > 0 && <ForgeSeam className="my-3" />}
                    <div className="flex items-start justify-between gap-2">
                      {isEditingThis ? (
                        <div className="w-full space-y-1.5">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
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
                        <>
                          <p className="text-xs text-pfx-text">{item.mensaje}</p>
                          {editable && (
                            <button
                              type="button"
                              aria-label={`Editar mensaje clave ${index + 1}`}
                              onClick={() => startEditMensaje(index)}
                              className="flex-shrink-0 text-pfx-text-muted transition-colors hover:text-pfx-accent"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {item.evidencias.length > 0 && (
                      <details className="mt-1.5 text-[11px]">
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
                  </li>
                );
              })}
            </ul>
          </ForgeZone>

          <ForgeZone state={zoneState} className="p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
              <Megaphone className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
              Llamados a acción
            </div>
            <div className="flex flex-wrap gap-2">
              {dna.llamadosAccion.map((cta, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-2.5 py-1 text-xs text-pfx-text"
                >
                  {cta.texto}
                  <span className={CHIP_CLASS}>{CTA_INTENT_LABEL[cta.intencion]}</span>
                </span>
              ))}
            </div>
          </ForgeZone>

          {dna.evidencias.length > 0 && (
            <ForgeZone as="section" className="p-4 text-xs">
              <details>
                <summary className="cursor-pointer text-sm font-medium text-pfx-text">
                  Evidencias globales ({dna.evidencias.length})
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {dna.evidencias.map((ev, i) => (
                    <li key={i} className="flex flex-col gap-0.5">
                      <span className="w-fit rounded bg-[hsl(var(--pfx-border)/0.4)] px-1 py-0.5 font-forge-mono text-[10px] text-pfx-text-muted">
                        {ev.sourceRef}
                      </span>
                      <span className="italic text-pfx-text-muted/80">&ldquo;{ev.cita}&rdquo;</span>
                    </li>
                  ))}
                </ul>
              </details>
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
