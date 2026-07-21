"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  History,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { setRunDecisionAction } from "@/app/(admin)/proyectos/pixelforge/actions";
import { usePixelforgeRun } from "@/hooks/pixelforge/use-pixelforge-run";
import { ForgeZone } from "@/components/pixelforge/forge/ForgeZone";
import { ForgeSeam } from "@/components/pixelforge/forge/ForgeSeam";

/** Vista (definida acá, no en el repo — mismo criterio que `DirectionCardView` en `DirectionCard.tsx`) de una fila de `pixelforge_page_versions`, con `createdAt` YA serializado a ISO por la page (mismo patrón que `sealedAt` en `BlueprintPanel`/`DirectionsPanel`: los `Date` de Drizzle se convierten a ISO ANTES de cruzar al client component). */
export interface ProductionVersionView {
  id: string;
  version: number;
  notas: string;
  warnings: string[];
  createdByName: string;
  /** ISO. */
  createdAt: string;
}

interface Props {
  projectId: string;
  /** true si el artifact `narrative_blueprint` está sellado — habilita componer/recomponer. */
  blueprintSealed: boolean;
  /**
   * ISO del sellado del Blueprint vigente (null si nunca se selló). Usado
   * SOLO para el aviso de obsolescencia: si la versión vigente se compuso
   * ANTES de este sellado, quedó desactualizada (D6).
   */
  blueprintSealedAt: string | null;
  /** Todas las versiones del proyecto, orden desc por `version` (la vigente es `versions[0]`) — tal como las devuelve `listPageVersions`. */
  versions: ProductionVersionView[];
}

/** Chip técnico (mono, DNA: "chips técnicos y números" → font-forge-mono). */
const CHIP_CLASS = "rounded-full px-2 py-0.5 font-forge-mono text-[11px] font-medium";
/** Chip de warning — mismo ámbar que `DirectionCard` usa para "Desarrollo custom requerido". */
const WARNING_CHIP_CLASS = `${CHIP_CLASS} bg-[hsl(var(--pfx-warning)/0.12)] text-pfx-warning`;

/**
 * Formatea una fecha ISO a es-MX `dd mmm yyyy` (ej. "18 jul 2026"). Duplica
 * (deliberadamente, es una función privada de ~10 líneas) el criterio de
 * `ForgeStamp`'s `formatSealedDate` — NO se reusa ese componente acá porque
 * imprime literalmente "SELLADO · <fecha>" y Producción no sella nada en F7
 * (D6/D7: QA/sellado de producción es F8); la materialidad de "landing
 * compuesta" toma el estilo mono de `ForgeStamp` (tracking amplio, acero) sin
 * el label de sellado.
 */
function formatVersionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("es-MX", { day: "2-digit", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" })
    .format(date)
    .replace(/\.$/, "")
    .toLowerCase();
  const year = new Intl.DateTimeFormat("es-MX", { year: "numeric", timeZone: "UTC" }).format(date);
  return `${day} ${month} ${year}`;
}

/**
 * Panel operativo de la estación Producción (F7-T5, la última tarea de la
 * fase): dispara `compose_page_tree`, muestra la versión vigente de la
 * landing compuesta (número, fecha, autor, notas del composer, warnings) y
 * el historial de versiones. Calco estructural de `BlueprintPanel` (mismo
 * ciclo generar → forging → éxito/fallo, mismo gate `locked`, mismo confirm
 * de "Re-generar"), con DOS diferencias de fondo que D6 mandata:
 *
 * 1. SIN edición de árbol ni `SealBar`: Producción no sella un artifact en F7
 *    (`STATION_ARTIFACT.produccion === null`, D7) — "Recomponer" siempre crea
 *    la SIGUIENTE versión (`insertPageVersion`, append-only), nunca reemplaza
 *    la actual. La materialidad de la zona de la vigente usa
 *    `ForgeZone state="sealed"` (plancha sólida, "sealed-like" per D6)
 *    aunque no haya un sello real — comunica "esto ya es un resultado
 *    asentado", no "borrador en progreso" (`draft`).
 *
 * 2. Feedback 👍/👎 atado al `runId` de la corrida recién completada EN ESTA
 *    SESIÓN (estado local), NO a un `lastRunId` persistido desde la page —
 *    calco de `DirectionsPanel` (`generate_directions`), NO de `BlueprintPanel`:
 *    `compose_page_tree` tiene el mismo problema estructural que
 *    `generate_directions` (su `persistResult` escribe a una tabla propia,
 *    `insertPageVersion`, nunca pasa por `updateArtifactDraft`, así que no hay
 *    ningún artifact que guarde un `lastRunId`) y, a diferencia de
 *    `narrative_blueprint`/`landing_dna`/`visual_dna`, `pixelforge_page_versions`
 *    tampoco tiene una columna `runId` (D1: `id, project_id, version, tree,
 *    notas, warnings, created_by_id/name, created_at` — deliberadamente sin
 *    ella). Persistir el feedback más allá de la sesión actual exigiría una
 *    migración/repo nuevos fuera del alcance de D6; se acepta la misma
 *    limitación que `DirectionsPanel` ya documenta para el caso gemelo.
 */
export function ProductionPanel({ projectId, blueprintSealed, blueprintSealedAt, versions }: Props) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [recomposeConfirming, setRecomposeConfirming] = useState(false);
  const [decisionGiven, setDecisionGiven] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);

  const { run } = usePixelforgeRun(runId);
  const handledRunRef = useRef<string | null>(null);

  useEffect(() => {
    if (!run || !runId || handledRunRef.current === runId) return;
    if (run.status === "succeeded") {
      handledRunRef.current = runId;
      toast.success("Landing compuesta");
      setDecisionGiven(false);
      router.refresh();
    } else if (run.status === "failed") {
      handledRunRef.current = runId;
      const msg = run.error ?? "No se pudo componer la landing";
      setFailureMessage(msg);
      toast.error(msg);
    }
  }, [run, runId, router]);

  const isGenerating = starting || (!!runId && handledRunRef.current !== runId);
  const canCompose = blueprintSealed;
  const current = versions[0] ?? null;
  const history = versions;

  // Obsolescencia (D6): la vigente se compuso ANTES del sellado actual del
  // Blueprint — el usuario reabrió/re-selló el Blueprint DESPUÉS de esta
  // composición, así que la landing quedó desactualizada respecto al guion
  // vigente. Comparación por `getTime()` (no lexicográfica de los strings
  // ISO) — ambos ya vienen normalizados a UTC por `toISOString()` en la page,
  // pero esto es robusto igual si alguna vez no lo estuvieran.
  const obsolete =
    !!current && !!blueprintSealedAt && new Date(current.createdAt).getTime() < new Date(blueprintSealedAt).getTime();

  const startCompose = async () => {
    setStarting(true);
    setFailureMessage(null);
    setRecomposeConfirming(false);
    handledRunRef.current = null;
    try {
      const res = await fetch("/api/pixelforge/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, operation: "compose_page_tree" }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? "No se pudo iniciar la composición";
        setFailureMessage(msg);
        toast.error(msg);
        return;
      }
      // Contrato async (fire-and-forget) — el resultado llega por el poller (`usePixelforgeRun`).
      setRunId(json.runId ?? null);
    } catch {
      const msg = "No se pudo iniciar la composición";
      setFailureMessage(msg);
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const submitDecision = async (decision: "accepted" | "rejected") => {
    if (!runId || decisionBusy) return;
    setDecisionBusy(true);
    const r = await setRunDecisionAction({ runId, decision });
    setDecisionBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "No se pudo registrar tu respuesta");
      return;
    }
    setDecisionGiven(true);
  };

  const emptyStateHint = !blueprintSealed
    ? "Sella el Blueprint para componer la landing"
    : "La IA usa el Blueprint narrativo sellado para construir el árbol de la landing.";

  return (
    <div className="space-y-4">
      {isGenerating && (
        <ForgeZone state="forging" variant="elevated" className="p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-pfx-accent" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm text-pfx-text">{run?.currentStep ?? "Componiendo la landing…"}</p>
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
            onClick={startCompose}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.1)] px-3 py-1.5 text-xs font-medium text-pfx-warning transition-colors hover:bg-[hsl(var(--pfx-warning)/0.2)]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      )}

      {!current ? (
        !isGenerating &&
        (canCompose ? (
          <ForgeZone variant="elevated" state="draft" className="px-6 py-16 text-center">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-pfx-accent" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-pfx-text">
                Todavía no hay una landing compuesta para este proyecto
              </p>
              <p className="mt-1 text-xs text-pfx-text-muted">{emptyStateHint}</p>
            </div>
            <button
              type="button"
              onClick={startCompose}
              className="mx-auto mt-4 flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Componer landing
            </button>
          </ForgeZone>
        ) : (
          // locked: el Blueprint narrativo no está sellado — mismo criterio de
          // gate que `BlueprintPanel`/`DirectionsPanel`
          // (docs/pixelforge/product-dna.md § Estados canónicos, "locked",
          // uso 2; precondición real verificada en el guard de
          // `compose_page_tree`, src/app/api/pixelforge/runs/route.ts).
          <ForgeZone variant="elevated" state="locked" className="px-6 py-16 text-center">
            <Lock className="mx-auto mb-3 h-6 w-6 text-pfx-forge-locked" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-pfx-text">
                Todavía no hay una landing compuesta para este proyecto
              </p>
              <p className="mt-1 text-xs text-pfx-text-muted">{emptyStateHint}</p>
            </div>
            <button
              type="button"
              onClick={startCompose}
              disabled
              title={emptyStateHint}
              className="mx-auto mt-4 flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent opacity-40"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Componer landing
            </button>
          </ForgeZone>
        ))
      ) : (
        <div className="space-y-4">
          {obsolete && (
            <div className="flex items-start gap-2 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.08)] px-3 py-2.5 text-xs text-pfx-warning">
              <RotateCcw className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              La landing fue compuesta con un blueprint anterior — recompón para actualizarla.
            </div>
          )}

          <ForgeZone state="sealed" variant="elevated" className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-[200px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-pfx-accent" aria-hidden="true" />
                  <span className="font-forge-mono text-base font-bold text-pfx-text">v{current.version}</span>
                  <span className="font-forge-mono text-[11px] uppercase tracking-[0.18em] text-pfx-text-muted">
                    {formatVersionDate(current.createdAt)} · {current.createdByName}
                  </span>
                </div>
                {current.notas && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-pfx-text">{current.notas}</p>
                )}
                {current.warnings.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {current.warnings.map((warning, i) => (
                      <span key={i} className={WARNING_CHIP_CLASS}>
                        {warning}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {!isGenerating && (
                <div className="flex-shrink-0">
                  {!recomposeConfirming ? (
                    <button
                      type="button"
                      onClick={() => setRecomposeConfirming(true)}
                      disabled={!blueprintSealed}
                      title={!blueprintSealed ? emptyStateHint : undefined}
                      className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-3 py-1.5 text-xs font-medium text-pfx-text-muted transition-colors hover:text-pfx-text disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Recomponer
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-pfx-warning">Esto crea una nueva versión</span>
                      <button
                        type="button"
                        onClick={startCompose}
                        className="rounded-[var(--pfx-radius)] bg-pfx-warning px-3 py-1.5 text-xs font-medium text-pfx-canvas transition-colors hover:opacity-90"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecomposeConfirming(false)}
                        className="text-xs text-pfx-text-muted hover:text-pfx-text"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ForgeZone>

          <ForgeZone state="sealed" className="p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
              <History className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
              Historial de versiones
              <span className="ml-auto font-forge-mono text-xs text-pfx-text-muted">{history.length}</span>
            </div>
            <ul>
              {history.map((v, i) => (
                <li key={v.id}>
                  {i > 0 && <ForgeSeam className="my-2" />}
                  <div className="flex flex-wrap items-center gap-2 py-1 text-xs">
                    <span className="font-forge-mono font-semibold text-pfx-text">v{v.version}</span>
                    <span className="font-forge-mono text-pfx-text-muted">{formatVersionDate(v.createdAt)}</span>
                    <span className="text-pfx-text-muted">{v.createdByName}</span>
                  </div>
                </li>
              ))}
            </ul>
          </ForgeZone>

          {runId && run?.status === "succeeded" && (
            <ForgeZone state="draft" className="p-3">
              <div className="flex items-center gap-3 px-1">
                {decisionGiven ? (
                  <p className="text-xs text-pfx-text-muted">Gracias por el feedback</p>
                ) : (
                  <>
                    <span className="text-xs text-pfx-text-muted">¿Te sirvió esta composición?</span>
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
