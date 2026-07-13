import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { VpsSymptom, VpsSymptomSeverity, VpsAuditReport } from "@/lib/vps-types";

const SEVERITY_ORDER: Record<VpsSymptomSeverity, number> = {
  red: 0,
  yellow: 1,
  green: 2,
};

const SEVERITY_ICON: Record<VpsSymptomSeverity, typeof AlertCircle> = {
  red: AlertCircle,
  yellow: AlertTriangle,
  green: CheckCircle2,
};

const SEVERITY_DOT: Record<VpsSymptomSeverity, string> = {
  red: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]",
  yellow: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]",
  green: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]",
};

const SEVERITY_TEXT: Record<VpsSymptomSeverity, string> = {
  red: "text-red-400",
  yellow: "text-amber-400",
  green: "text-emerald-400",
};

const SEVERITY_PILL: Record<VpsSymptomSeverity, string> = {
  red: "border-red-500/30 bg-red-500/10 text-red-300",
  yellow: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
};

function relativeTime(isoDate: string): string {
  try {
    return formatDistanceToNow(new Date(isoDate), {
      locale: es,
      addSuffix: true,
    });
  } catch {
    return "—";
  }
}

function SymptomRow({ symptom }: { symptom: VpsSymptom }) {
  const Icon = SEVERITY_ICON[symptom.severity];

  return (
    <li className="flex items-start gap-3 border-b border-zinc-800/60 py-3 last:border-b-0">
      <span
        className={cn(
          "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
          SEVERITY_DOT[symptom.severity]
        )}
        aria-hidden="true"
      />
      <Icon
        className={cn("mt-0.5 h-4 w-4 shrink-0", SEVERITY_TEXT[symptom.severity])}
        strokeWidth={1.75}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-poppins text-sm font-semibold text-zinc-50">
            {symptom.message}
          </p>
          <span className="font-roboto text-xs uppercase tracking-wide text-zinc-500">
            {symptom.area}
          </span>
        </div>
        <p className="font-roboto text-xs text-zinc-400">
          {symptom.suggestedAction}
        </p>
      </div>
    </li>
  );
}

export function SymptomReport({ report }: { report: VpsAuditReport }) {
  const sortedSymptoms = [...report.symptoms].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-5 backdrop-blur-xl",
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-zinc-600/50 before:to-transparent"
      )}
    >
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-poppins text-lg font-semibold text-zinc-200">
            Reporte de síntomas
          </h2>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-roboto text-xs font-medium",
                SEVERITY_PILL.red
              )}
            >
              {report.summary.red} críticos
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-roboto text-xs font-medium",
                SEVERITY_PILL.yellow
              )}
            >
              {report.summary.yellow} alertas
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-roboto text-xs font-medium",
                SEVERITY_PILL.green
              )}
            >
              {report.summary.green} ok
            </span>
          </div>
        </div>
        {report.generatedAt && (
          <span className="font-roboto text-xs text-zinc-500">
            Actualizado {relativeTime(report.generatedAt)}
          </span>
        )}
      </div>

      <div className="relative mt-4">
        {sortedSymptoms.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ClipboardList className="h-6 w-6 text-zinc-600" strokeWidth={1.75} />
            <p className="font-roboto text-sm text-zinc-500">
              Sin datos de auditoría
            </p>
          </div>
        ) : (
          <ul>
            {sortedSymptoms.map((symptom) => (
              <SymptomRow key={symptom.id} symptom={symptom} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
