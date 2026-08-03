import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** CTAs — botones ya construidos por el llamador. */
  actions?: React.ReactNode;
  /** `error` cambia el acento; la forma es la misma. */
  tone?: "neutral" | "error";
  className?: string;
}

/**
 * Estado vacío/de error estándar del módulo. Un vacío bien explicado es parte
 * del producto (guía qué hacer); un vacío mudo parece pantalla incompleta.
 */
export function EmptyState({ icon: Icon, title, description, actions, tone = "neutral", className }: EmptyStateProps) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center",
        tone === "error" ? "border-red-500/30 bg-red-500/5" : "border-border bg-card/40",
        className
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full border",
          tone === "error" ? "border-red-500/30 text-red-400" : "border-border text-cyan-500"
        )}
      >
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{actions}</div> : null}
    </div>
  );
}
