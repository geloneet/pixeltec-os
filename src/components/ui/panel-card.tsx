import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PanelCard — shell compartido para paneles de lista del dashboard (header
 * con icono + título uppercase, slot de contenido).
 *
 * Extraído del shell duplicado literal en
 * `src/components/hoy/active-projects-panel.tsx` y
 * `src/components/hoy/recent-clients-panel.tsx` al rediseñar la distribución
 * de `/hoy` (excepción al freeze de v1.0 — ver PixelTEC OS.md en NeuroPIXEL).
 */
export function PanelCard({
  icon: Icon,
  title,
  action,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  /** Elemento opcional a la derecha del título (p. ej. link "Ver todos"). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-5 shadow-sm", className)}>
      <header className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-300" strokeWidth={1.75} />
        <h2 className="flex-1 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
