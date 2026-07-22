"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { usePixelforgeQaRun } from "@/hooks/pixelforge/use-pixelforge-qa-run";
import { computeQaGateState } from "@/lib/pixelforge/qa/gate-state";
import { ForgeZone } from "@/components/pixelforge/forge/ForgeZone";
import { ForgeSeam } from "@/components/pixelforge/forge/ForgeSeam";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Vistas serializables (fechas ya en ISO — mismo criterio que
// `ProductionVersionView` en `ProductionPanel.tsx`: los `Date` de Drizzle se
// convierten a ISO ANTES de cruzar de `qa/page.tsx` (server) a este client
// component) ─────────────────────────────────────────────────────────────

export interface QaFindingLocationView {
  nodeId?: string;
  viewport?: string;
  slot?: string;
  selectorHash?: string;
}

export interface QaFindingView {
  id: string;
  checkCode: string;
  category: string;
  severity: "critical" | "major" | "minor" | "info";
  blocking: boolean;
  source: string;
  title: string;
  description: string;
  recommendation: string;
  evidence: unknown;
  location: QaFindingLocationView | null;
  locationKey: string;
}

export interface QaCategoryScoreView {
  score: number;
  weight: number;
  penalty: number;
  findings: number;
}

export interface QaRunView {
  id: string;
  pageVersionId: string;
  /** Version de la `page_version` que evaluó este run — joineado en `qa/page.tsx` desde `listPageVersions` (el run en sí no guarda el número). */
  pageVersionNumber: number;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  currentPhase: string | null;
  verdict: "pass" | "pass_with_warnings" | "fail" | null;
  scoreTotal: number | null;
  categoryScores: Record<string, QaCategoryScoreView> | null;
  catalogVersion: string;
  scoringVersion: string;
  humanDecision: "approved" | "rejected" | null;
  humanDecisionByName: string | null;
  /** ISO. */
  humanDecisionAt: string | null;
  humanDecisionReason: string | null;
  error: string | null;
  /** ISO. */
  createdAt: string;
  /** ISO. */
  finishedAt: string | null;
}

interface Props {
  projectId: string;
  /** La `page_version` vigente del proyecto, o `null` si todavía no compone ninguna (gate de entrada `locked`). */
  currentPageVersion: { id: string; version: number } | null;
  /** id del qa_run `queued`/`running` al momento de cargar la page (para retomar el polling sin esperar la primera acción del usuario), o `null`. */
  initialActiveRunId: string | null;
  /** TODAS las corridas de QA del proyecto (metadata, SIN findings), orden desc por `createdAt` — tal como `listQaRunsForProject`. */
  runs: QaRunView[];
  /** Findings del qa_run cerrado más reciente de la VIGENTE (`gate.currentVersionRun`), `[]` si no hay ninguno. */
  currentRunFindings: QaFindingView[];
  /** `assetId → url` de los `pixelforge_assets` kind `qa_screenshot` del proyecto — resuelto en `qa/page.tsx` desde `getPixelforgeProjectFull().assets` (mismo patrón in-memory-join que `visual/page.tsx` usa para `visualReferences`), sin tocar el backend. */
  screenshotUrlByAssetId: Record<string, string>;
}

const SEVERITIES: QaFindingView["severity"][] = ["critical", "major", "minor", "info"];

const SEVERITY_LABELS: Record<QaFindingView["severity"], string> = {
  critical: "Crítico",
  major: "Mayor",
  minor: "Menor",
  info: "Info",
};

const SEVERITY_CHIP_ACTIVE_CLASS: Record<QaFindingView["severity"], string> = {
  critical: "border-pfx-error/50 bg-[hsl(var(--pfx-error)/0.12)] text-pfx-error",
  major: "border-pfx-warning/50 bg-[hsl(var(--pfx-warning)/0.12)] text-pfx-warning",
  minor: "border-pfx-accent/50 bg-[hsl(var(--pfx-accent)/0.1)] text-pfx-accent",
  info: "border-pfx-border-strong bg-pfx-surface-elevated text-pfx-text-muted",
};

const SEVERITY_CHIP_INACTIVE_CLASS =
  "border-pfx-border bg-transparent text-pfx-text-muted/60 hover:text-pfx-text-muted";

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "estructura", label: "Estructura" },
  { value: "diseno", label: "Diseño" },
  { value: "visual", label: "Visual" },
  { value: "accesibilidad", label: "Accesibilidad" },
  { value: "tecnico", label: "Técnico" },
  { value: "motion", label: "Motion" },
  { value: "capacidades", label: "Capacidades" },
  { value: "ia", label: "IA" },
];
const CATEGORY_LABEL_BY_VALUE = new Map(CATEGORY_OPTIONS.map((c) => [c.value, c.label]));

/** Los 3 viewports de la pasada nav (T6, `scripts/qa-runner/viewports.ts`) — duplicado deliberado del ancho para el label es-MX, no se importa desde `scripts/` (fuera del árbol de `src/`, build aparte del qa-runner). */
const VIEWPORT_LABELS: Record<string, string> = {
  desktop: "escritorio 1280",
  tablet: "tablet 768",
  mobile: "móvil 390",
};

const PHASE_LABELS: Record<string, string> = {
  determinista: "Inspección estructural",
  navegador: "Prueba en el banco (navegador)",
  ia: "Ojo del maestro (IA)",
  cierre: "Veredicto",
};

function phaseLabel(phase: string | null | undefined): string {
  return (phase && PHASE_LABELS[phase]) || "Preparando la inspección…";
}

const VERDICT_DISPLAY: Record<
  NonNullable<QaRunView["verdict"]>,
  { label: string; textClass: string; Icon: typeof CheckCircle2 }
> = {
  pass: { label: "TEMPLADA", textClass: "text-pfx-success", Icon: CheckCircle2 },
  pass_with_warnings: { label: "TEMPLADA CON RESERVAS", textClass: "text-pfx-warning", Icon: AlertTriangle },
  fail: { label: "QUEBRADIZA", textClass: "text-pfx-error", Icon: XCircle },
};

const MIN_REASON_LENGTH = 5;
/** Sentinel para el `Select` de comparación sin selección — Radix `Select` exige `value` siempre string (mismo criterio que `NONE_DEFINITION` en `NewPixelforgeForm.tsx`, nunca `undefined` controlado). */
const NONE_COMPARE = "__none__";

/**
 * Formatea una fecha ISO a es-MX `dd mmm yyyy` — duplica deliberadamente
 * `formatSealedDate`/`formatVersionDate` (mismo criterio documentado en
 * `ProductionPanel.tsx`: NO se reusa `ForgeStamp` acá porque imprime
 * literalmente "SELLADO · <fecha>" y un `qa_run` no es un artifact sellado —
 * el veredicto necesita su propio label/color por caso, así que se
 * construye una estampa propia con el mismo estilo mono).
 */
function formatQaDate(iso: string): string {
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

function formatLocation(location: QaFindingLocationView | null): string | null {
  if (!location) return null;
  const parts: string[] = [];
  if (location.nodeId) parts.push(location.nodeId);
  if (location.viewport) parts.push(VIEWPORT_LABELS[location.viewport] ?? location.viewport);
  if (location.slot) parts.push(location.slot);
  if (parts.length === 0 && location.selectorHash) parts.push(location.selectorHash);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** `evidence.screenshotAssetId` si `evidence` lo trae — forma laxa (jsonb, `unknown`). */
function screenshotAssetIdOf(evidence: unknown): string | null {
  if (!evidence || typeof evidence !== "object") return null;
  const id = (evidence as Record<string, unknown>).screenshotAssetId;
  return typeof id === "string" ? id : null;
}

/** Rúbrica IA (score/veredicto/criteria) si `evidence` la trae, directa (QA-IA-001/002) o anidada en `.rubric` (QA-IA-003, `persistLikenessFindings`). `null` si no aplica. */
function rubricOf(evidence: unknown): { score: number; veredicto: string; criteria: RubricCriterio[] } | null {
  if (!evidence || typeof evidence !== "object") return null;
  const obj = evidence as Record<string, unknown>;
  const candidate = Array.isArray(obj.criteria) ? obj : Array.isArray((obj.rubric as Record<string, unknown>)?.criteria) ? obj.rubric : null;
  if (!candidate || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  if (!Array.isArray(c.criteria)) return null;
  return { score: Number(c.score), veredicto: String(c.veredicto ?? ""), criteria: c.criteria as RubricCriterio[] };
}

interface RubricCriterio {
  nombre: string;
  score: number;
  reasons: string[];
  warnings: string[];
  confidence: string;
}

function findingKey(f: Pick<QaFindingView, "checkCode" | "locationKey">): string {
  return `${f.checkCode}|${f.locationKey}`;
}

/**
 * QaStationPanel — estación QA (PF-F8 T7). Dispara el QA, muestra progreso
 * por fases, el "Temple" (verdict/score/categorías) de la vigente, los
 * findings filtrables con evidencia, la comparación entre versiones y la
 * aprobación humana con razón. NUNCA recomputa verdict/score/gate — todo
 * viene de las columnas de `qa_run` (`runs`/`currentRunFindings`, props) o
 * del helper puro `computeQaGateState` (mismo criterio que ya aplica el
 * backend, ver `gate-state.ts`).
 */
export function QaStationPanel({
  projectId,
  currentPageVersion,
  initialActiveRunId,
  runs,
  currentRunFindings,
  screenshotUrlByAssetId,
}: Props) {
  const router = useRouter();

  const gate = useMemo(
    () => computeQaGateState<QaRunView>(runs, currentPageVersion?.id ?? null),
    [runs, currentPageVersion?.id]
  );

  // ─── Disparar / rastrear una corrida ─────────────────────────────────────
  const [runId, setRunId] = useState<string | null>(initialActiveRunId);
  const [starting, setStarting] = useState(false);
  const [startConfirming, setStartConfirming] = useState(false);
  const handledRunRef = useRef<string | null>(null);
  const { run: liveRun } = usePixelforgeQaRun(runId);

  useEffect(() => {
    if (!liveRun || !runId || handledRunRef.current === runId) return;
    if (liveRun.status === "succeeded") {
      handledRunRef.current = runId;
      const verdict = liveRun.verdict;
      if (verdict === "pass") toast.success("Landing templada — pasó QA");
      else if (verdict === "pass_with_warnings") toast.warning("QA con reservas — requiere tu aprobación");
      else if (verdict === "fail") toast.error("QA quebradizo — hay hallazgos bloqueantes");
      else toast.success("QA terminado");
      router.refresh();
    } else if (liveRun.status === "failed") {
      handledRunRef.current = runId;
      toast.error(liveRun.error ?? "El QA no pudo completarse");
      router.refresh();
    }
  }, [liveRun, runId, router]);

  const isRunning = !!runId && handledRunRef.current !== runId;
  const hasOtherActiveRun = !isRunning && runs.some((r) => r.status === "queued" || r.status === "running");

  const startQa = async () => {
    setStarting(true);
    setStartConfirming(false);
    handledRunRef.current = null;
    try {
      const res = await fetch("/api/pixelforge/qa/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "No se pudo iniciar el QA");
        return;
      }
      setRunId(json.qaRunId ?? null);
    } catch {
      toast.error("No se pudo iniciar el QA");
    } finally {
      setStarting(false);
    }
  };

  const requestStart = () => {
    if (gate.currentVersionRun?.verdict === "pass") {
      setStartConfirming(true);
      return;
    }
    void startQa();
  };

  // ─── Decisión humana (pass_with_warnings) ────────────────────────────────
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const decisionReasonValid = decisionReason.trim().length >= MIN_REASON_LENGTH;

  const submitDecision = async (decision: "approved" | "rejected") => {
    if (!gate.currentVersionRun || decisionBusy || !decisionReasonValid) return;
    setDecisionBusy(true);
    try {
      const res = await fetch(`/api/pixelforge/qa/runs/${gate.currentVersionRun.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: decisionReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "No se pudo registrar la decisión");
        return;
      }
      toast.success(decision === "approved" ? "QA aprobado con reservas" : "QA rechazado");
      setDecisionReason("");
      router.refresh();
    } catch {
      toast.error("No se pudo registrar la decisión");
    } finally {
      setDecisionBusy(false);
    }
  };

  // ─── Findings: filtros + expandido ───────────────────────────────────────
  const [activeSeverities, setActiveSeverities] = useState<Set<QaFindingView["severity"]>>(
    () => new Set(SEVERITIES)
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedRubricIds, setExpandedRubricIds] = useState<Set<string>>(new Set());
  const [screenshotDialogUrl, setScreenshotDialogUrl] = useState<string | null>(null);

  const severityCounts = useMemo(() => {
    const counts: Record<QaFindingView["severity"], number> = { critical: 0, major: 0, minor: 0, info: 0 };
    for (const f of currentRunFindings) counts[f.severity]++;
    return counts;
  }, [currentRunFindings]);

  const filteredFindings = useMemo(
    () =>
      currentRunFindings.filter(
        (f) => activeSeverities.has(f.severity) && (categoryFilter === "all" || f.category === categoryFilter)
      ),
    [currentRunFindings, activeSeverities, categoryFilter]
  );

  const toggleSeverity = (s: QaFindingView["severity"]) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRubric = (id: string) => {
    setExpandedRubricIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Comparación de versiones ─────────────────────────────────────────────
  const compareCandidates = useMemo(
    () =>
      runs.filter(
        (r) => r.status === "succeeded" && r.verdict !== null && r.id !== gate.currentVersionRun?.id
      ),
    [runs, gate.currentVersionRun?.id]
  );
  const [compareRunId, setCompareRunId] = useState<string | null>(null);
  const { run: compareRunRaw, findings: compareFindingsRaw } = usePixelforgeQaRun(compareRunId);
  const compareCandidate = compareCandidates.find((c) => c.id === compareRunId) ?? null;

  const comparableCatalog =
    !!gate.currentVersionRun && !!compareRunRaw && compareRunRaw.catalogVersion === gate.currentVersionRun.catalogVersion;

  const comparison = useMemo(() => {
    if (!gate.currentVersionRun || !compareRunRaw || !comparableCatalog) return null;
    const compareScoreTotal = compareRunRaw.scoreTotal;
    const compareCategoryScores = (compareRunRaw.categoryScores ?? {}) as Record<string, QaCategoryScoreView>;
    const currentCategoryScores = gate.currentVersionRun.categoryScores ?? {};

    const scoreDelta =
      gate.currentVersionRun.scoreTotal !== null && compareScoreTotal !== null
        ? gate.currentVersionRun.scoreTotal - compareScoreTotal
        : null;

    const categoryDeltas = CATEGORY_OPTIONS.map((cat) => {
      const currentScore = currentCategoryScores[cat.value]?.score ?? null;
      const compareScore = compareCategoryScores[cat.value]?.score ?? null;
      const delta = currentScore !== null && compareScore !== null ? currentScore - compareScore : null;
      return { category: cat.value, label: cat.label, delta };
    });

    const compareKeys = new Set(compareFindingsRaw.map((f) => `${f.checkCode}|${f.locationKey}`));
    const currentKeys = new Set(currentRunFindings.map(findingKey));

    const nuevos = currentRunFindings.filter((f) => !compareKeys.has(findingKey(f)));
    const persistentes = currentRunFindings.filter((f) => compareKeys.has(findingKey(f)));
    const resueltos = compareFindingsRaw.filter((f) => !currentKeys.has(`${f.checkCode}|${f.locationKey}`));

    return { scoreDelta, categoryDeltas, nuevos, persistentes, resueltos };
  }, [gate.currentVersionRun, compareRunRaw, compareFindingsRaw, comparableCatalog, currentRunFindings]);

  // ─── Gate de entrada: sin page_version vigente ───────────────────────────
  if (!currentPageVersion) {
    return (
      <ForgeZone variant="elevated" state="locked" className="px-6 py-16 text-center">
        <Lock className="mx-auto mb-3 h-6 w-6 text-pfx-forge-locked" aria-hidden="true" />
        <p className="text-sm font-medium text-pfx-text">Todavía no hay metal que templar</p>
        <p className="mt-1 text-xs text-pfx-text-muted">
          Compón la landing en Producción para templar el metal.
        </p>
        <Link
          href={`/proyectos/pixelforge/${projectId}/produccion`}
          className="mx-auto mt-4 inline-flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong"
        >
          Ir a Producción
        </Link>
      </ForgeZone>
    );
  }

  const current = gate.currentVersionRun;
  const startDisabled = starting || isRunning || hasOtherActiveRun;

  return (
    <div className="space-y-4">
      {gate.obsolete && current === null && gate.latestClosedRun && (
        <div className="flex items-start gap-2 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.08)] px-3 py-2.5 text-xs text-pfx-warning">
          <RotateCcw className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          Este temple corresponde a v{gate.latestClosedRun.pageVersionNumber}; la vigente es v
          {currentPageVersion.version} — re-ejecuta QA.
        </div>
      )}

      {isRunning ? (
        <ForgeZone state="forging" variant="elevated" className="p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-pfx-accent" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm text-pfx-text">{phaseLabel(liveRun?.currentPhase)}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--pfx-border)/0.6)]">
                <div
                  className="h-full rounded-full bg-pfx-accent transition-all"
                  style={{ width: `${Math.max(5, liveRun?.progress ?? 5)}%` }}
                />
              </div>
            </div>
          </div>
        </ForgeZone>
      ) : current ? (
        <ForgeZone state="sealed" variant="elevated" className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const display = VERDICT_DISPLAY[current.verdict!];
                  const Icon = display.Icon;
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 font-forge-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${display.textClass}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {display.label}
                    </span>
                  );
                })()}
                <span className="font-forge-mono text-sm font-bold text-pfx-text">v{current.pageVersionNumber}</span>
                <span className="font-forge-mono text-[11px] uppercase tracking-[0.14em] text-pfx-text-muted">
                  {formatQaDate(current.createdAt)} · catalog v{current.catalogVersion} · scoring v
                  {current.scoringVersion}
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-forge-mono text-3xl font-extrabold text-pfx-text">{current.scoreTotal}</span>
                <span className="text-xs text-pfx-text-muted">/ 100</span>
              </div>
            </div>

            <button
              type="button"
              onClick={requestStart}
              disabled={startDisabled}
              className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-3 py-1.5 text-xs font-medium text-pfx-text-muted transition-colors hover:text-pfx-text disabled:cursor-not-allowed disabled:opacity-40"
            >
              {starting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Re-ejecutar QA
            </button>
          </div>

          {startConfirming && (
            <div className="mt-3 flex items-center gap-2 border-t border-pfx-border pt-3">
              <span className="text-[11px] text-pfx-warning">
                Esta landing ya pasó QA — ¿re-ejecutar de todas formas?
              </span>
              <button
                type="button"
                onClick={startQa}
                className="rounded-[var(--pfx-radius)] bg-pfx-warning px-3 py-1.5 text-xs font-medium text-pfx-canvas transition-colors hover:opacity-90"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setStartConfirming(false)}
                className="text-xs text-pfx-text-muted hover:text-pfx-text"
              >
                Cancelar
              </button>
            </div>
          )}

          {current.categoryScores && (
            <div className="mt-4 space-y-2 border-t border-pfx-border pt-3">
              {CATEGORY_OPTIONS.map((cat) => {
                const catScore = current.categoryScores?.[cat.value];
                if (!catScore) return null;
                return (
                  <div
                    key={cat.value}
                    className="flex items-center gap-2"
                    title={`Penalización: ${catScore.penalty} pts · ${catScore.findings} hallazgo(s)`}
                  >
                    <span className="w-24 flex-shrink-0 text-[11px] text-pfx-text-muted">{cat.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--pfx-border)/0.6)]">
                      <div
                        className="h-full rounded-full bg-pfx-accent"
                        style={{ width: `${Math.max(0, Math.min(100, catScore.score))}%` }}
                      />
                    </div>
                    <span className="w-20 flex-shrink-0 text-right font-forge-mono text-[11px] text-pfx-text-muted">
                      {catScore.score} · peso {Math.round(catScore.weight)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ForgeZone>
      ) : (
        <ForgeZone variant="elevated" state="draft" className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-pfx-text">La vigente todavía no tiene un QA cerrado</p>
          <p className="mt-1 text-xs text-pfx-text-muted">Dispara la inspección para templar v{currentPageVersion.version}.</p>
          <button
            type="button"
            onClick={requestStart}
            disabled={startDisabled}
            className="mx-auto mt-4 flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
          >
            {starting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            Ejecutar QA
          </button>
        </ForgeZone>
      )}

      {/* ─── Aprobación humana (pass_with_warnings) ─────────────────────── */}
      {!isRunning && current && current.verdict === "pass_with_warnings" && !current.humanDecision && (
        <ForgeZone state="draft" variant="elevated" className="p-4">
          <p className="text-sm font-medium text-pfx-text">Aprobar con reservas</p>
          <p className="mt-1 text-xs text-pfx-text-muted">
            Este temple tiene hallazgos no bloqueantes — registra por qué lo apruebas (o recházalo) antes de
            abrir la compuerta a Revisión.
          </p>
          <textarea
            value={decisionReason}
            onChange={(e) => setDecisionReason(e.target.value)}
            rows={2}
            placeholder="Explica tu decisión (mínimo 5 caracteres)…"
            className="mt-2 w-full resize-none rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3 py-2 text-sm text-pfx-text placeholder:text-pfx-text-muted/60 focus:outline-none focus:ring-2 focus:ring-pfx-accent/40"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => submitDecision("approved")}
              disabled={!decisionReasonValid || decisionBusy}
              className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] bg-pfx-accent px-3 py-1.5 text-xs font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
            >
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
              Aprobar con reservas
            </button>
            <button
              type="button"
              onClick={() => submitDecision("rejected")}
              disabled={!decisionReasonValid || decisionBusy}
              className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-3 py-1.5 text-xs font-medium text-pfx-text transition-colors hover:border-pfx-error/40 hover:text-pfx-error disabled:opacity-40"
            >
              <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
              Rechazar
            </button>
          </div>
        </ForgeZone>
      )}

      {/* ─── fail: CTA de vuelta a Producción ────────────────────────────── */}
      {!isRunning && current && current.verdict === "fail" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--pfx-radius)] border border-pfx-error/30 bg-[hsl(var(--pfx-error)/0.08)] px-3 py-2.5 text-xs text-pfx-error">
          <span>Hay hallazgos bloqueantes — no se puede aprobar este temple.</span>
          <Link
            href={`/proyectos/pixelforge/${projectId}/produccion`}
            className="flex-shrink-0 rounded-[var(--pfx-radius)] border border-pfx-error/30 bg-[hsl(var(--pfx-error)/0.1)] px-3 py-1.5 font-medium text-pfx-error transition-colors hover:bg-[hsl(var(--pfx-error)/0.2)]"
          >
            Volver a Producción para recomponer
          </Link>
        </div>
      )}

      {/* ─── Compuerta a Revisión ────────────────────────────────────────── */}
      {!isRunning && (
        <ForgeZone state={gate.open ? "sealed" : "draft"} className="p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {gate.open ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-pfx-success" aria-hidden="true" />
            ) : (
              <Lock className="h-4 w-4 flex-shrink-0 text-pfx-forge-locked" aria-hidden="true" />
            )}
            <span className="font-medium text-pfx-text">
              Compuerta a Revisión: {gate.open ? "abierta" : "cerrada"}
            </span>
          </div>
          {gate.open && current?.humanDecision === "approved" && (
            <p className="mt-1.5 text-xs text-pfx-text-muted">
              Aprobado por {current.humanDecisionByName ?? "alguien"}
              {current.humanDecisionAt && ` · ${formatQaDate(current.humanDecisionAt)}`}
              {current.humanDecisionReason && ` — "${current.humanDecisionReason}"`}
            </p>
          )}
          {!gate.open && (
            <p className="mt-1.5 text-xs text-pfx-text-muted">
              {gate.reason === "no_qa" && "Todavía no hay un QA cerrado para la vigente."}
              {gate.reason === "stale" && "El temple más reciente es de una versión anterior."}
              {gate.reason === "fail" && "El último temple quedó quebradizo."}
              {gate.reason === "pending_decision" && "Hay reservas pendientes de tu aprobación."}
              {gate.reason === "rejected" && "Rechazaste el último temple con reservas."}
            </p>
          )}
        </ForgeZone>
      )}

      {/* ─── Findings ────────────────────────────────────────────────────── */}
      {!isRunning && current && (
        <ForgeZone state="sealed" className="p-4">
          <p className="mb-3 text-sm font-medium text-pfx-text">Hallazgos</p>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSeverity(s)}
                aria-pressed={activeSeverities.has(s)}
                aria-label={`Filtrar severidad ${SEVERITY_LABELS[s]}`}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  activeSeverities.has(s) ? SEVERITY_CHIP_ACTIVE_CLASS[s] : SEVERITY_CHIP_INACTIVE_CLASS
                }`}
              >
                {SEVERITY_LABELS[s]} ({severityCounts[s]})
              </button>
            ))}

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger
                aria-label="Categoría"
                className="ml-auto w-44 rounded-[var(--pfx-radius)] border-pfx-border bg-pfx-surface text-xs text-pfx-text"
              >
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              {/*
                `SelectContent` (Radix) renderiza vía Portal a `document.body`,
                FUERA del wrapper `[data-product="pixelforge"]` que activa los
                tokens `--pfx-*` (bug conocido X1-T3) — se re-declara el
                atributo acá para reactivar el scope dentro del portal (mismo
                patrón que `NewPixelforgeForm.tsx`/`AddContextSourceForm.tsx`).
              */}
              <SelectContent
                className="border-pfx-border bg-pfx-surface-elevated text-pfx-text"
                data-product="pixelforge"
              >
                <SelectItem value="all">Todas las categorías</SelectItem>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredFindings.length === 0 ? (
            <p className="py-6 text-center text-xs text-pfx-text-muted">
              {currentRunFindings.length === 0 ? "Sin hallazgos — temple limpio." : "Ningún hallazgo con estos filtros."}
            </p>
          ) : (
            <ul>
              {filteredFindings.map((f, i) => {
                const expanded = expandedIds.has(f.id);
                const locationLabel = formatLocation(f.location);
                const screenshotAssetId = screenshotAssetIdOf(f.evidence);
                const screenshotUrl = screenshotAssetId ? screenshotUrlByAssetId[screenshotAssetId] : undefined;
                const rubric = f.source === "ia" ? rubricOf(f.evidence) : null;
                return (
                  <li key={f.id}>
                    {i > 0 && <ForgeSeam className="my-2" />}
                    <div className="py-1.5">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(f.id)}
                        className="flex w-full items-start gap-2 text-left"
                      >
                        {expanded ? (
                          <ChevronDown className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-pfx-text-muted" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-pfx-text-muted" aria-hidden="true" />
                        )}
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-forge-mono text-[11px] font-semibold text-pfx-text">
                              {f.checkCode}
                            </span>
                            {f.blocking && (
                              <span className="rounded-full border border-pfx-error/40 bg-[hsl(var(--pfx-error)/0.1)] px-1.5 py-0.5 font-forge-mono text-[10px] uppercase tracking-wide text-pfx-error">
                                bloqueante
                              </span>
                            )}
                            <span
                              className={`rounded-full px-1.5 py-0.5 font-forge-mono text-[10px] uppercase tracking-wide ${SEVERITY_CHIP_ACTIVE_CLASS[f.severity]}`}
                            >
                              {SEVERITY_LABELS[f.severity]}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-pfx-text">{f.title}</p>
                          {locationLabel && <p className="text-[11px] text-pfx-text-muted">{locationLabel}</p>}
                        </div>
                      </button>

                      {expanded && (
                        <div className="ml-5 mt-2 space-y-2 border-l border-pfx-border pl-3 text-xs">
                          <p className="text-pfx-text">{f.description}</p>

                          {rubric && (
                            <div>
                              <button
                                type="button"
                                onClick={() => toggleRubric(f.id)}
                                className="text-[11px] font-medium text-pfx-accent hover:underline"
                              >
                                {expandedRubricIds.has(f.id) ? "Ocultar rúbrica IA" : "Ver rúbrica IA"}
                              </button>
                              {expandedRubricIds.has(f.id) && (
                                <ul className="mt-1.5 space-y-1.5">
                                  {rubric.criteria.map((c) => (
                                    <li key={c.nombre} className="rounded-[var(--pfx-radius)] bg-pfx-surface-elevated p-2">
                                      <p className="font-medium text-pfx-text">
                                        {c.nombre} — {c.score}/100
                                      </p>
                                      <p className="mt-0.5 text-pfx-text-muted">{c.reasons.join(" ")}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          {!rubric && f.evidence != null && (
                            <pre className="overflow-x-auto rounded-[var(--pfx-radius)] bg-pfx-surface-elevated p-2 font-forge-mono text-[10px] text-pfx-text-muted">
                              {JSON.stringify(f.evidence, null, 2)}
                            </pre>
                          )}

                          {screenshotUrl && (
                            <button
                              type="button"
                              onClick={() => setScreenshotDialogUrl(screenshotUrl)}
                              className="flex items-center gap-1.5 text-[11px] font-medium text-pfx-accent hover:underline"
                            >
                              <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              Ver captura
                            </button>
                          )}

                          <p className="text-pfx-text-muted">
                            <span className="font-medium text-pfx-text">Recomendación:</span> {f.recommendation}
                          </p>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ForgeZone>
      )}

      {/* ─── Comparación de versiones ────────────────────────────────────── */}
      {!isRunning && current && compareCandidates.length > 0 && (
        <ForgeZone state="sealed" className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-pfx-text">Comparar con</p>
            <Select
              value={compareRunId ?? NONE_COMPARE}
              onValueChange={(v) => setCompareRunId(v === NONE_COMPARE ? null : v)}
            >
              <SelectTrigger
                aria-label="Comparar con"
                className="w-48 rounded-[var(--pfx-radius)] border-pfx-border bg-pfx-surface text-xs text-pfx-text"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className="border-pfx-border bg-pfx-surface-elevated text-pfx-text"
                data-product="pixelforge"
              >
                <SelectItem value={NONE_COMPARE}>Elige una versión…</SelectItem>
                {compareCandidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    v{c.pageVersionNumber} — {VERDICT_DISPLAY[c.verdict!].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {compareRunId && compareRunRaw && !comparableCatalog && (
            <p className="mt-3 text-xs text-pfx-text-muted">
              No comparable — el catálogo de checks cambió entre esa corrida y esta.
            </p>
          )}

          {comparison && compareCandidate && (
            <div className="mt-3 space-y-3 border-t border-pfx-border pt-3">
              <p className="text-xs text-pfx-text-muted">
                Score total:{" "}
                <span className="font-forge-mono font-semibold text-pfx-text">
                  {comparison.scoreDelta !== null && comparison.scoreDelta > 0 ? "▲" : comparison.scoreDelta !== null && comparison.scoreDelta < 0 ? "▼" : "="}{" "}
                  {comparison.scoreDelta !== null ? Math.abs(comparison.scoreDelta) : "—"}
                </span>{" "}
                vs v{compareCandidate.pageVersionNumber}
              </p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                {comparison.categoryDeltas.map((c) => (
                  <div key={c.category} className="text-[11px] text-pfx-text-muted">
                    {c.label}:{" "}
                    <span className="font-forge-mono text-pfx-text">
                      {c.delta === null ? "—" : c.delta > 0 ? `▲${c.delta}` : c.delta < 0 ? `▼${Math.abs(c.delta)}` : "="}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="mb-1 font-forge-mono text-[10px] uppercase tracking-wide text-pfx-text-muted">
                    Nuevos ({comparison.nuevos.length})
                  </p>
                  <ul className="space-y-0.5 text-[11px] text-pfx-text">
                    {comparison.nuevos.map((f) => (
                      <li key={f.id}>{f.checkCode}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-forge-mono text-[10px] uppercase tracking-wide text-pfx-text-muted">
                    Resueltos ({comparison.resueltos.length})
                  </p>
                  <ul className="space-y-0.5 text-[11px] text-pfx-text">
                    {comparison.resueltos.map((f) => (
                      <li key={f.id}>{f.checkCode}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-forge-mono text-[10px] uppercase tracking-wide text-pfx-text-muted">
                    Persistentes ({comparison.persistentes.length})
                  </p>
                  <ul className="space-y-0.5 text-[11px] text-pfx-text">
                    {comparison.persistentes.map((f) => (
                      <li key={f.id}>{f.checkCode}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </ForgeZone>
      )}

      {/*
        El Dialog (Radix Portal) renderiza en `document.body`, fuera del
        wrapper `[data-product="pixelforge"]` — se re-declara el atributo
        directo en `DialogContent` para reactivar los tokens `--pfx-*` dentro
        del portal (mismo bug/patrón X1-T3 que el `SelectContent` de arriba).
      */}
      <Dialog open={!!screenshotDialogUrl} onOpenChange={(open) => !open && setScreenshotDialogUrl(null)}>
        <DialogContent
          className="border-pfx-border bg-pfx-surface text-pfx-text sm:max-w-2xl"
          data-product="pixelforge"
        >
          <DialogHeader>
            <DialogTitle>Captura de evidencia</DialogTitle>
          </DialogHeader>
          {screenshotDialogUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- screenshot arbitrario de R2, sin dominio conocido para next/image.
            <img src={screenshotDialogUrl} alt="Captura de evidencia del hallazgo" className="w-full rounded-[var(--pfx-radius)] border border-pfx-border" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
