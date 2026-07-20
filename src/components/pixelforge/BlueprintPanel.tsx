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
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
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
import { ForgeZone, type ForgeState } from "@/components/pixelforge/forge/ForgeZone";
import { ForgeSeam } from "@/components/pixelforge/forge/ForgeSeam";
import { ForgeStamp } from "@/components/pixelforge/forge/ForgeStamp";
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
  /**
   * ISO del sellado (PF-X2 T4, calco de `LandingDnaPanel`/`VisualDnaPanel`) —
   * habilita la `ForgeStamp` en la plancha de "Historia" cuando
   * `artifactStatus === "sealed"`. Puramente presentacional: sin este prop el
   * panel simplemente no muestra la estampa (no rompe consumidores existentes).
   */
  sealedAt?: string | null;
}

const ACTO_FIELDS: { key: ActoFieldKey; label: string }[] = [
  { key: "proposito", label: "Propósito" },
  { key: "mensaje", label: "Mensaje" },
  { key: "tension", label: "Tensión" },
  { key: "resolucion", label: "Resolución" },
];

/** Chip técnico (mono, DNA: "chips técnicos y números" → font-forge-mono). */
const CHIP_CLASS =
  "rounded-full bg-[hsl(var(--pfx-border)/0.4)] px-2 py-0.5 font-forge-mono text-[11px] text-pfx-text-muted";

/** Clona el blueprint completo y aplica la edición sobre la copia — nunca se manda un parche parcial al backend. */
function cloneBlueprint(blueprint: NarrativeBlueprint): NarrativeBlueprint {
  return JSON.parse(JSON.stringify(blueprint)) as NarrativeBlueprint;
}

/**
 * Materialidad de las planchas del blueprint según el status del artifact
 * (docs/pixelforge/product-dna.md § Estados canónicos). `forging` se reserva
 * a la plancha dedicada de progreso (`isGenerating`, más abajo) para no
 * duplicar la señal de "trabajándose" en cada zona simultáneamente.
 */
function zoneStateForArtifact(status: PixelforgeArtifactStatus): ForgeState {
  if (status === "sealed") return "sealed";
  if (status === "invalidated") return "invalidated";
  return "draft";
}

/**
 * Panel operativo del Blueprint narrativo (estación Blueprint, F6A / reskin
 * PF-X2 T4, la última de esta fase): dispara `build_narrative`, muestra el
 * resultado (historia, actos, momentos cinematográficos, notas de
 * producción) y permite editar el borrador — incluyendo reordenar actos por
 * BOTONES (nunca drag-and-drop, ver docstring de `moveActo`). Calco
 * estructural de `LandingDnaPanel` (X2-T2): los actos son "planchas
 * ancladas" en secuencia — la secuencia ES el producto — por eso viven
 * DENTRO de una sola `ForgeZone` (una veta izquierda continua atraviesa todo
 * el bloque) separados por `ForgeSeam` horizontales, en vez de una plancha
 * suelta por acto (evita "borde completo" repetido rompiendo la lectura de
 * secuencia — docs/pixelforge/product-dna.md § shapeLanguage). El sellado en
 * sí vive en `SealBar` (componente hermano).
 */
export function BlueprintPanel({
  projectId,
  artifactStatus,
  blueprint,
  decisionSealed,
  directionObsolete,
  lastRunId,
  sealedAt,
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
  const [reordering, setReordering] = useState(false);
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
  /**
   * Guard `reordering`: sin esto, doble-click rápido en Subir/Bajar dispara
   * un segundo `moveActo` mientras el primer `persistDraft` sigue en vuelo —
   * ese segundo swap parte de `sortedActos`/`blueprint` (props) TODAVÍA
   * viejos (el primer `router.refresh()` no ha resuelto), así que calcula el
   * swap sobre un estado obsoleto y puede pisar el resultado del primero.
   * Se fija ANTES de persistir y se limpia en el `finally` (también si
   * `persistDraft` falla) — ambos botones se deshabilitan mientras está en
   * `true`.
   */
  const moveActo = async (orden: number, direction: "up" | "down") => {
    if (!blueprint || reordering) return;
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
    setReordering(true);
    try {
      await persistDraft(clone);
    } finally {
      setReordering(false);
    }
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
        <ForgeZone state="invalidated" className="p-3">
          <div className="flex items-start gap-2 text-xs text-pfx-warning">
            <RotateCcw className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            Este Blueprint narrativo quedó invalidado por reapertura de una estación anterior.
            Re-genéralo o revísalo y vuelve a sellar.
          </div>
        </ForgeZone>
      )}

      {directionObsolete && (
        <div className="flex items-start gap-2 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.08)] px-3 py-2.5 text-xs text-pfx-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          La elección quedó obsoleta — vuelve a elegir.
        </div>
      )}

      {isGenerating && (
        <ForgeZone state="forging" variant="elevated" className="p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-pfx-accent" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm text-pfx-text">
                {run?.currentStep ?? "Construyendo blueprint narrativo…"}
              </p>
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

      {!blueprint ? (
        !isGenerating &&
        (canGenerate ? (
          <ForgeZone variant="elevated" state="draft" className="px-6 py-16 text-center">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-pfx-accent" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-pfx-text">
                Todavía no hay un blueprint narrativo para este proyecto
              </p>
              <p className="mt-1 text-xs text-pfx-text-muted">{emptyStateHint}</p>
            </div>
            <button
              type="button"
              onClick={startGeneration}
              className="mx-auto mt-4 flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Generar blueprint narrativo
            </button>
          </ForgeZone>
        ) : (
          // locked: la generación está gateada (decisión de dirección sin
          // sellar) — el panel explica el gate sin romper la navegación de la
          // estación actual (docs/pixelforge/product-dna.md § Estados
          // canónicos, "locked", uso 2; precondición real verificada en el
          // guard de `build_narrative`, src/app/api/pixelforge/runs/route.ts).
          <ForgeZone variant="elevated" state="locked" className="px-6 py-16 text-center">
            <Lock className="mx-auto mb-3 h-6 w-6 text-pfx-forge-locked" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-pfx-text">
                Todavía no hay un blueprint narrativo para este proyecto
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
              Generar blueprint narrativo
            </button>
          </ForgeZone>
        ))
      ) : (
        <div className="space-y-4">
          <ForgeZone state={zoneState} variant="elevated" className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-[200px] flex-1">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-pfx-text-muted">
                  <BookOpen className="h-3.5 w-3.5 text-pfx-accent" aria-hidden="true" />
                  Historia
                </div>
                <p className="whitespace-pre-wrap text-sm text-pfx-text">{blueprint.historia}</p>
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

          <ForgeZone state={zoneState} className="p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
              <Layers className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
              Actos
              <span className="ml-auto font-forge-mono text-xs text-pfx-text-muted">
                {sortedActos.length}
              </span>
            </div>
            <div>
              {sortedActos.map((acto, i) => {
                const isEditingThis = editingActo === acto.orden;
                return (
                  <div key={acto.orden}>
                    {i > 0 && <ForgeSeam className="my-3" />}
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--pfx-border)/0.4)] font-forge-mono text-xs font-semibold text-pfx-text">
                        {acto.orden}
                      </span>

                      {editable && (
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Subir acto ${acto.orden}`}
                            onClick={() => moveActo(acto.orden, "up")}
                            disabled={i === 0 || reordering}
                            className="text-pfx-text-muted transition-colors hover:text-pfx-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-pfx-text-muted"
                          >
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Bajar acto ${acto.orden}`}
                            onClick={() => moveActo(acto.orden, "down")}
                            disabled={i === sortedActos.length - 1 || reordering}
                            className="text-pfx-text-muted transition-colors hover:text-pfx-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-pfx-text-muted"
                          >
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          {!isEditingThis && (
                            <button
                              type="button"
                              aria-label={`Editar acto ${acto.orden}`}
                              onClick={() => startEditActo(acto)}
                              className="text-pfx-text-muted transition-colors hover:text-pfx-accent"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditingThis ? (
                      <div className="mt-2 space-y-2">
                        {ACTO_FIELDS.map((f) => (
                          <div key={f.key}>
                            <label className="mb-1 block text-[11px] font-medium text-pfx-text-muted">
                              {f.label}
                            </label>
                            <textarea
                              value={editFields[f.key]}
                              onChange={(e) =>
                                setEditFields((prev) => ({ ...prev, [f.key]: e.target.value }))
                              }
                              rows={2}
                              className="w-full resize-none rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-2 py-1.5 text-xs text-pfx-text focus:outline-none focus:ring-2 focus:ring-pfx-accent"
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
                            className="rounded-[var(--pfx-radius)] bg-pfx-accent px-2.5 py-1 text-[11px] font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditActo}
                            className="text-[11px] text-pfx-text-muted hover:text-pfx-text"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-1.5 text-xs">
                        <p>
                          <span className="font-medium text-pfx-text-muted">Propósito: </span>
                          <span className="text-pfx-text">{acto.proposito}</span>
                        </p>
                        <p>
                          <span className="font-medium text-pfx-text-muted">Mensaje: </span>
                          <span className="text-pfx-text">{acto.mensaje}</span>
                        </p>
                        <p>
                          <span className="font-medium text-pfx-text-muted">Tensión: </span>
                          <span className="text-pfx-text">{acto.tension}</span>
                        </p>
                        <p>
                          <span className="font-medium text-pfx-text-muted">Resolución: </span>
                          <span className="text-pfx-text">{acto.resolucion}</span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ForgeZone>

          {blueprint.cinematicMoments.length > 0 && (
            <ForgeZone state={zoneState} className="p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
                <Camera className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
                Momentos cinematográficos
              </div>
              <ul className="flex flex-col">
                {blueprint.cinematicMoments.map((m, i) => (
                  <li key={i}>
                    {i > 0 && <ForgeSeam className="my-3" />}
                    <span className={CHIP_CLASS}>Acto {m.actoOrden}</span>
                    <p className="mt-1.5 text-xs text-pfx-text">{m.descripcion}</p>
                    <p className="mt-1 text-[11px] text-pfx-text-muted">{m.motifConnection}</p>
                  </li>
                ))}
              </ul>
            </ForgeZone>
          )}

          <ForgeZone state={zoneState} className="p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
              <ClipboardList className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
              Notas de producción
            </div>

            {blueprint.notasProduccion.length === 0 ? (
              <p className="text-xs text-pfx-text-muted/60">Sin notas</p>
            ) : (
              <ul className="flex flex-col">
                {blueprint.notasProduccion.map((nota, i) => (
                  <li key={i}>
                    {i > 0 && <ForgeSeam className="my-3" />}
                    <div className="flex items-start justify-between gap-2 text-xs text-pfx-text">
                      <span className="whitespace-pre-wrap">{nota}</span>
                      {editable && (
                        <button
                          type="button"
                          aria-label={`Quitar nota ${i + 1}`}
                          onClick={() => removeNote(i)}
                          className="flex-shrink-0 text-pfx-text-muted transition-colors hover:text-pfx-error"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
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
                  className="flex-1 rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-2 py-1.5 text-xs text-pfx-text placeholder:text-pfx-text-muted/60 focus:outline-none focus:ring-2 focus:ring-pfx-accent"
                />
                <button
                  type="button"
                  onClick={addNote}
                  disabled={!newNote.trim()}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-2.5 py-1.5 text-xs font-medium text-pfx-text transition-colors hover:text-pfx-accent disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Agregar
                </button>
              </div>
            )}
          </ForgeZone>

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
