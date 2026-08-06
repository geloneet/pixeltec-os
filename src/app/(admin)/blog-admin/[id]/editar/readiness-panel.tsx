"use client";

import { AlertTriangle, CheckCircle2, Lightbulb, ShieldAlert, ShieldCheck } from "lucide-react";
import type { PublicationIssue, PublicationVerdict } from "@/lib/blog/publication-gate";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Estado agregado del gate. El blocker `status` (post aún no aprobado) se
 *  trata aparte: si es el ÚNICO blocker y no hay warnings, el contenido está
 *  completo y el estado es "Listo para revisión" — no "Bloqueado". Las
 *  sugerencias (B-PR4) no participan del nivel: son opcionales por diseño. */
type ReadinessLevel = "blocked" | "warnings" | "ready-review" | "ready-publish";

function computeLevel(verdict: PublicationVerdict): ReadinessLevel {
  const contentBlockers = verdict.blockers.filter((b) => b.code !== "status");
  const hasStatusBlocker = verdict.blockers.some((b) => b.code === "status");
  if (contentBlockers.length > 0) return "blocked";
  if (verdict.warnings.length > 0) return "warnings";
  if (hasStatusBlocker) return "ready-review";
  return "ready-publish";
}

const LEVEL_META: Record<
  ReadinessLevel,
  { label: string; className: string; Icon: typeof ShieldAlert }
> = {
  blocked: {
    label: "Bloqueado",
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    Icon: ShieldAlert,
  },
  warnings: {
    label: "Con advertencias",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    Icon: AlertTriangle,
  },
  "ready-review": {
    label: "Listo para revisión",
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    Icon: ShieldCheck,
  },
  "ready-publish": {
    label: "Listo para publicar",
    className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
    Icon: CheckCircle2,
  },
};

/** Umbral de colapso de sugerencias: más de 3 se pliegan en un <details>. */
const SUGGESTIONS_COLLAPSE_ABOVE = 3;

interface IssueListProps {
  issues: PublicationIssue[];
  className: string;
  Icon: typeof ShieldAlert;
  onIssueClick?: (issue: PublicationIssue) => void;
}

/** Cada issue es CLICABLE (B-PR4): navega a la etapa y campo que lo origina. */
function IssueList({ issues, className, Icon, onIssueClick }: IssueListProps) {
  return (
    <ul className="space-y-1.5">
      {issues.map((issue) => (
        <li key={issue.code}>
          <button
            type="button"
            onClick={() => onIssueClick?.(issue)}
            className={cn(
              "flex w-full items-start gap-2 rounded-md text-left text-xs",
              "hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              className,
            )}
          >
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{issue.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface ReadinessPanelProps {
  verdict: PublicationVerdict | null;
  loading: boolean;
  onIssueClick?: (issue: PublicationIssue) => void;
}

export function ReadinessPanel({ verdict, loading, onIssueClick }: ReadinessPanelProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Publicación
        </h3>
        {loading && <Spinner size="sm" />}
      </div>

      {!verdict && !loading && (
        <p className="text-xs text-muted-foreground">
          No se pudo evaluar el estado de publicación.
        </p>
      )}

      {verdict && (
        <>
          {(() => {
            const level = computeLevel(verdict);
            const meta = LEVEL_META[level];
            return (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                  meta.className,
                )}
              >
                <meta.Icon className="h-4 w-4 shrink-0" />
                {meta.label}
              </div>
            );
          })()}

          {/* ── Bloqueos ── */}
          {verdict.blockers.length > 0 && (
            <IssueList
              issues={verdict.blockers}
              className="text-red-600 dark:text-red-400"
              Icon={ShieldAlert}
              onIssueClick={onIssueClick}
            />
          )}

          {/* ── Advertencias ── */}
          {verdict.warnings.length > 0 && (
            <div className="border-t border-border pt-2">
              <IssueList
                issues={verdict.warnings}
                className="text-amber-600 dark:text-amber-400"
                Icon={AlertTriangle}
                onIssueClick={onIssueClick}
              />
            </div>
          )}

          {/* ── Sugerencias (B-PR4): tono muted, colapsables si son muchas ── */}
          {(verdict.suggestions ?? []).length > 0 && (
            <div className="border-t border-border pt-2">
              {(verdict.suggestions ?? []).length > SUGGESTIONS_COLLAPSE_ABOVE ? (
                <details>
                  <summary className="cursor-pointer select-none text-xs text-blue-600/80 dark:text-blue-400/80 hover:text-blue-600 dark:hover:text-blue-400">
                    Sugerencias ({(verdict.suggestions ?? []).length})
                  </summary>
                  <div className="mt-1.5">
                    <IssueList
                      issues={verdict.suggestions ?? []}
                      className="text-blue-600/80 dark:text-blue-400/80"
                      Icon={Lightbulb}
                      onIssueClick={onIssueClick}
                    />
                  </div>
                </details>
              ) : (
                <IssueList
                  issues={verdict.suggestions ?? []}
                  className="text-blue-600/80 dark:text-blue-400/80"
                  Icon={Lightbulb}
                  onIssueClick={onIssueClick}
                />
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
