"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import type { PublicationVerdict } from "@/lib/blog/publication-gate";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Estado agregado del gate. El blocker `status` (post aún no aprobado) se
 *  trata aparte: si es el ÚNICO blocker y no hay warnings, el contenido está
 *  completo y el estado es "Listo para revisión" — no "Bloqueado". */
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

interface ReadinessPanelProps {
  verdict: PublicationVerdict | null;
  loading: boolean;
}

export function ReadinessPanel({ verdict, loading }: ReadinessPanelProps) {
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

          {verdict.blockers.length > 0 && (
            <ul className="space-y-1.5">
              {verdict.blockers.map((issue) => (
                <li
                  key={issue.code}
                  className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400"
                >
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          )}

          {verdict.warnings.length > 0 && (
            <ul className="space-y-1.5 border-t border-border pt-2">
              {verdict.warnings.map((issue) => (
                <li
                  key={issue.code}
                  className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
