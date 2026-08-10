import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TINTS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;

/**
 * QuickActionCard — tira de accesos rápidos del dashboard, tinte sutil por
 * `--chart-N` (vidrio tintado, no pastel — Bento Dark, ADR-0003). Nueva pieza
 * para la distribución de `/hoy` (excepción al freeze de v1.0).
 */
export function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
  tint = 0,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  /** Índice 0-4 sobre la paleta `--chart-1..5` para variar el tinte por tarjeta. */
  tint?: number;
}) {
  const token = TINTS[tint % TINTS.length];

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/50 p-4 backdrop-blur-xl transition-all duration-300 hover:border-border hover:bg-card/60"
      )}
      style={{ backgroundColor: `hsl(var(--${token}) / 0.08)` }}
    >
      <div className="flex items-start justify-between">
        <Icon className="h-4 w-4 text-foreground/80" strokeWidth={1.75} />
        <ArrowUpRight
          className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </div>
      <div className="mt-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
