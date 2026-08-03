import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SemanticBadgeProps {
  label: string;
  /** Clases semánticas de meta.ts / STATUS_META / CLASSIFICATION_META. */
  className?: string;
  icon?: LucideIcon;
  /** Título accesible cuando el label visible es el corto. */
  title?: string;
}

/**
 * Badge semántico único del módulo: modo, estado de atención y clasificación
 * comparten esta forma. El color viene siempre de un mapa central (meta.ts o
 * types/whatsapp-inbox), nunca hardcodeado en el punto de uso.
 */
export function SemanticBadge({ label, className, icon: Icon, title }: SemanticBadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {Icon ? <Icon aria-hidden className="h-3 w-3" /> : null}
      {label}
    </span>
  );
}
