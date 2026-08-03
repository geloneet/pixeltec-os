import { cn } from "@/lib/utils";

interface WhatsAppSectionProps {
  title: string;
  /** Una línea bajo el título que explica para qué sirve la sección. */
  description?: string;
  /** Acción contextual alineada a la derecha del título (botón, contador…). */
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Sección estándar del módulo WhatsApp. Reemplaza las cuatro copias locales
 * de `SectionCard` (BotConfigView, ContactPanel, ExamplesView,
 * ConfigVersionsPanel) que ya habían empezado a divergir.
 */
export function WhatsAppSection({ title, description, actions, className, children }: WhatsAppSectionProps) {
  return (
    <section className={cn("space-y-3 rounded-xl border border-border bg-card/40 p-4", className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground/80">{description}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
