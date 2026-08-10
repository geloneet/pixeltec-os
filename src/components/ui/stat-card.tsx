import { ArrowUp, ArrowDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StatCard — tarjeta de KPI compartida, tratamiento visual Bento Dark.
 *
 * Promovida desde `src/app/(admin)/vps/components/server-stats-header.tsx`
 * (StatCard local, no exportada) al rediseñar la distribución de `/hoy`
 * (excepción al freeze de v1.0 — ver PixelTEC OS.md en NeuroPIXEL). El
 * original de VPS se deja intacto para no tocar ese módulo, fuera de alcance
 * de este cambio; la deduplicación completa (VPS consumiendo esta versión)
 * queda como follow-up.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  delta,
  children,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  /** Línea de tendencia opcional (verde/roja) bajo el valor principal. */
  delta?: { value: string; direction: "up" | "down"; note?: string };
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-xl transition-all duration-300",
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-border before:to-transparent",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/[0.03] after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100",
        "hover:border-border hover:bg-card/60",
        className
      )}
    >
      <div className="relative flex items-center justify-between">
        <span className="font-roboto text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <div className="relative mt-3 flex items-baseline gap-2">
        <span className="font-league-spartan text-3xl font-bold tabular-nums text-foreground">
          {value}
        </span>
        {detail && (
          <span className="font-roboto text-xs text-muted-foreground">{detail}</span>
        )}
      </div>
      {delta && (
        <div
          className={cn(
            "relative mt-1.5 flex items-center gap-1 text-xs font-medium",
            delta.direction === "up" ? "text-emerald-400" : "text-red-400"
          )}
        >
          {delta.direction === "up" ? (
            <ArrowUp className="h-3 w-3" strokeWidth={2} />
          ) : (
            <ArrowDown className="h-3 w-3" strokeWidth={2} />
          )}
          <span>{delta.value}</span>
          {delta.note && <span className="text-muted-foreground">{delta.note}</span>}
        </div>
      )}
      {children && <div className="relative mt-4">{children}</div>}
    </div>
  );
}
