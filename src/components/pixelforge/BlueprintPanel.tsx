"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import {
  updateArtifactDraftAction,
  setRunDecisionAction,
} from "@/app/(admin)/proyectos/pixelforge/actions";
import { usePixelforgeRun } from "@/hooks/pixelforge/use-pixelforge-run";
import type { PixelforgeArtifactStatus } from "@/lib/pixelforge/types";
import type { NarrativeBlueprint } from "@/lib/pixelforge/schemas/build-narrative";

type Acto = NarrativeBlueprint["actos"][number];
type ActoFieldKey = "proposito" | "mensaje" | "tension" | "resolucion";

interface Props {
  projectId: string;
  artifactStatus: PixelforgeArtifactStatus;
  blueprint: NarrativeBlueprint | null;
  /** true si la Decisión de dirección está sellada — habilita generar el blueprint narrativo. */
  decisionSealed: boolean;
  /**
   * true si la dirección elegida ya no está vigente (defensa en profundidad,
   * mismo cálculo que `direcciones/page.tsx`). El backend igual rechaza con
   * 409 ("La elección quedó obsoleta") si se intenta generar en este
   * estado — acá solo se refleja como aviso.
   */
  directionObsolete?: boolean;
  /** Corrida IA más reciente asociada al draft actual — habilita los botones de decisión (👍/👎). */
  lastRunId?: string | null;
}

const ACTO_FIELDS: { key: ActoFieldKey; label: string }[] = [
  { key: "proposito", label: "Propósito" },
  { key: "mensaje", label: "Mensaje" },
  { key: "tension", label: "Tensión" },
  { key: "resolucion", label: "Resolución" },
];

const CHIP_CLASS =
  "rounded-full bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground";

/** Clona el blueprint completo y aplica la edición sobre la copia — nunca se manda un parche parcial al backend. */
function cloneBlueprint(blueprint: NarrativeBlueprint): NarrativeBlueprint {
  return JSON.parse(JSON.stringify(blueprint)) as NarrativeBlueprint;
}

/**
 * Panel operativo del Blueprint narrativo (estación Blueprint, F6A): dispara
 * `build_narrative`, muestra el resultado (historia, actos, momentos
 * cinematográficos, notas de producción) y permite editar el borrador
 * — incluyendo reordenar actos por BOTONES (nunca drag-and-drop, ver
 * docstring de `moveActo`). Calco estructural de `VisualDnaPanel` — el
 * sellado en sí vive en `SealBar` (componente hermano).
 */
export function BlueprintPanel({
  projectId,
  artifactStatus,
  blueprint,
  decisionSealed,
  directionObsolete,
  lastRunId,
}: Props) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [regenerateConfirming, setRegenerateConfirming] = useState(false);
  // orden del acto en edición inline (null = ninguno).
  const [editingActo, setEditingActo] = useState<number | null>(null);
  const [editFields, setEditFields] = useState<Record<ActoFieldKey, string>>({
    proposito: "",
    mensaje: "",
    tension: "",
    resolucion: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [decisionGiven, setDecisionGiven] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);

  const { run } = usePixelforgeRun(runId);
  const handledRunRef = useRef<string | null>(null);

  useEffect(() => {
    if (!run || !runId || handledRunRef.current === runId) return;
    if (run.status === "succeeded") {
      handledRunRef.current = runId;
      toast.success("Blueprint narrativo generado");
      setRunId(null);
      router.refresh();
    } else if (run.status === "failed") {
      handledRunRef.current = runId;
      const msg = run.error ?? "No se pudo generar el blueprint narrativo";
      setFailureMessage(msg);
      toast.error(msg);
    }
  }, [run, runId, router]);

  const editable = artifactStatus !== "sealed";
  const isGenerating = starting || (!!runId && handledRunRef.current !== runId);
  const canGenerate = decisionSealed;

  const startGeneration = async () => {
    setStarting(true);
    setFailureMessage(null);
    setRegenerateConfirming(false);
    handledRunRef.current = null;
    try {
      const res = await fetch("/api/pixelforge/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, operation: "build_narrative" }),
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

  const persistDraft = async (draft: NarrativeBlueprint) => {
    const r = await updateArtifactDraftAction({ projectId, kind: "narrative_blueprint", draft });
    if (!r.success) {
      toast.error(r.error ?? "No se pudo guardar el borrador");
      return false;
    }
    toast.success("Borrador actualizado");
    router.refresh();
    return true;
  };

  const sortedActos: Acto[] = blueprint ? [...blueprint.actos].sort((a, b) => a.orden - b.orden) : [];

  /**
   * Reorder SOLO por botones subir/bajar (nunca drag-and-drop — F6B trata
   * animación/DnD, fuera de alcance acá). Intercambia el acto con su vecino
   * adyacente y renumera `orden` 1..n para todo el arreglo (regla de dominio
   * del superRefine en `narrativeBlueprintSchema`). Los `cinematicMoments`
   * están ligados a un acto por CONTENIDO vía `actoOrden`, no por posición —
   * al intercambiar dos actos, sus `orden` viejos se remapean entre sí
   * (swap simétrico) para que los momentos sigan apuntando al mismo acto.
   */
  const moveActo = async (orden: number, direction: "up" | "down") => {
    if (!blueprint) return;
    const idx = sortedActos.findIndex((a) => a.orden === orden);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sortedActos.length) return;

    const ordenA = sortedActos[idx].orden;
    const ordenB = sortedActos[swapIdx].orden;

    const next = [...sortedActos];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const renumbered = next.map((acto, i) => ({ ...acto, orden: i + 1 }));

    const clone = cloneBlueprint(blueprint);
    clone.actos = renumbered;
    clone.cinematicMoments = clone.cinematicMoments.map((m) =>
      m.actoOrden === ordenA
        ? { ...m, actoOrden: ordenB }
        : m.actoOrden === ordenB
          ? { ...m, actoOrden: ordenA }
          : m
    );

    // Cancela cualquier edición inline en curso ANTES de persistir — el
    // `orden` de los actos cambia con el swap, y `editingActo`/`editFields`
    // quedarían apuntando a un `orden` cuya posición ahora tiene OTRO
    // contenido (buffer de edición mostrando texto viejo sobre un acto
    // distinto). Más simple y seguro reiniciar que intentar remapear.
    cancelEditActo();
    await persistDraft(clone);
  };

  const startEditActo = (acto: Acto) => {
    setEditingActo(acto.orden);
    setEditFields({
      proposito: acto.proposito,
      mensaje: acto.mensaje,
      tension: acto.tension,
      resolucion: acto.resolucion,
    });
  };

  const cancelEditActo = () => {
    setEditingActo(null);
  };

  const saveEditActo = async () => {
    if (editingActo === null || !blueprint || savingEdit) return;
    if (ACTO_FIELDS.some((f) => editFields[f.key].trim().length === 0)) return;
    setSavingEdit(true);
    const clone = cloneBlueprint(blueprint);
    const acto = clone.actos.find((a) => a.orden === editingActo);
    if (acto) {
      acto.proposito = editFields.proposito;
      acto.mensaje = editFields.mensaje;
      acto.tension = editFields.tension;
      acto.resolucion = editFields.resolucion;
    }
    const ok = await persistDraft(clone);
    setSavingEdit(false);
    if (ok) cancelEditActo();
  };

  const addNote = async () => {
    const trimmed = newNote.trim();
    if (!blueprint || !trimmed) return;
    const clone = cloneBlueprint(blueprint);
    clone.notasProduccion.push(trimmed);
    const ok = await persistDraft(clone);
    if (ok) setNewNote("");
  };

  const removeNote = async (index: number) => {
    if (!blueprint) return;
    const clone = cloneBlueprint(blueprint);
    clone.notasProduccion.splice(index, 1);
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

  const emptyStateHint = !decisionSealed
    ? "Sella la decisión de dirección primero"
    : "La IA usa la Decisión de dirección sellada para construir la historia, los actos y los momentos cinematográficos.";

  return (
    <div className="space-y-4">
      {artifactStatus === "invalidated" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          Este Blueprint narrativo quedó invalidado por reapertura de una estación anterior.
          Re-genéralo o revísalo y vuelve a sellar.
        </div>
      )}

      {directionObsolete && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          La elección quedó obsoleta — vuelve a elegir.
        </div>
      )}

      {isGenerating && (
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-card p-5">
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-cyan-400" />
          <div className="flex-1">
            <p className="text-sm text-foreground">{run?.currentStep ?? "Construyendo blueprint narrativo…"}</p>
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

      {!blueprint ? (
        !isGenerating && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
            <Sparkles className="h-6 w-6 text-cyan-400" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Todavía no hay un blueprint narrativo para este proyecto
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{emptyStateHint}</p>
            </div>
            <button
              type="button"
              onClick={startGeneration}
              disabled={!canGenerate}
              title={!canGenerate ? emptyStateHint : undefined}
              className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" />
              Generar blueprint narrativo
            </button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-cyan-500/20 bg-card p-4">
            <div className="min-w-[200px] flex-1">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
                Historia
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{blueprint.historia}</p>
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

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Layers className="h-4 w-4 text-cyan-400" />
              Actos
            </div>
            <div className="space-y-3">
              {sortedActos.map((acto, i) => {
                const isEditingThis = editingActo === acto.orden;
                return (
                  <div key={acto.orden} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-semibold text-cyan-500">
                        {acto.orden}
                      </span>

                      {editable && (
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Subir acto ${acto.orden}`}
                            onClick={() => moveActo(acto.orden, "up")}
                            disabled={i === 0}
                            className="text-muted-foreground transition-colors hover:text-cyan-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted-foreground"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Bajar acto ${acto.orden}`}
                            onClick={() => moveActo(acto.orden, "down")}
                            disabled={i === sortedActos.length - 1}
                            className="text-muted-foreground transition-colors hover:text-cyan-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted-foreground"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          {!isEditingThis && (
                            <button
                              type="button"
                              aria-label={`Editar acto ${acto.orden}`}
                              onClick={() => startEditActo(acto)}
                              className="text-muted-foreground transition-colors hover:text-cyan-400"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditingThis ? (
                      <div className="mt-2 space-y-2">
                        {ACTO_FIELDS.map((f) => (
                          <div key={f.key}>
                            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                              {f.label}
                            </label>
                            <textarea
                              value={editFields[f.key]}
                              onChange={(e) =>
                                setEditFields((prev) => ({ ...prev, [f.key]: e.target.value }))
                              }
                              rows={2}
                              className="w-full resize-none rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                            />
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={saveEditActo}
                            disabled={
                              savingEdit || ACTO_FIELDS.some((f) => editFields[f.key].trim().length === 0)
                            }
                            className="rounded-md bg-cyan-500 px-2.5 py-1 text-[11px] font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditActo}
                            className="text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-1.5 text-xs">
                        <p>
                          <span className="font-medium text-muted-foreground">Propósito: </span>
                          <span className="text-foreground">{acto.proposito}</span>
                        </p>
                        <p>
                          <span className="font-medium text-muted-foreground">Mensaje: </span>
                          <span className="text-foreground">{acto.mensaje}</span>
                        </p>
                        <p>
                          <span className="font-medium text-muted-foreground">Tensión: </span>
                          <span className="text-foreground">{acto.tension}</span>
                        </p>
                        <p>
                          <span className="font-medium text-muted-foreground">Resolución: </span>
                          <span className="text-foreground">{acto.resolucion}</span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {blueprint.cinematicMoments.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Camera className="h-4 w-4 text-cyan-400" />
                Momentos cinematográficos
              </div>
              <ul className="flex flex-col gap-3">
                {blueprint.cinematicMoments.map((m, i) => (
                  <li key={i} className="rounded-md border border-border/60 bg-secondary/20 p-3">
                    <span className={CHIP_CLASS}>Acto {m.actoOrden}</span>
                    <p className="mt-1.5 text-xs text-foreground">{m.descripcion}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{m.motifConnection}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ClipboardList className="h-4 w-4 text-cyan-400" />
              Notas de producción
            </div>

            {blueprint.notasProduccion.length === 0 ? (
              <p className="text-xs text-muted-foreground/60">Sin notas</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {blueprint.notasProduccion.map((nota, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-2 rounded-md border border-border/60 bg-secondary/20 px-3 py-2 text-xs text-foreground"
                  >
                    <span className="whitespace-pre-wrap">{nota}</span>
                    {editable && (
                      <button
                        type="button"
                        aria-label={`Quitar nota ${i + 1}`}
                        onClick={() => removeNote(i)}
                        className="flex-shrink-0 text-muted-foreground transition-colors hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {editable && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Agregar una nota de producción…"
                  className="flex-1 rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                />
                <button
                  type="button"
                  onClick={addNote}
                  disabled={!newNote.trim()}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:text-cyan-400 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              </div>
            )}
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
        </div>
      )}
    </div>
  );
}
