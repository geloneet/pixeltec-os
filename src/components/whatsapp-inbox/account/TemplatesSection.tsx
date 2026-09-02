"use client";

import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import type { MessageTemplate } from "@/lib/whatsapp/management-types";
import { EmptyState } from "../ui/EmptyState";
import { SemanticBadge } from "../ui/SemanticBadge";
import { WhatsAppSection } from "../ui/WhatsAppSection";
import { NewTemplateDialog } from "./NewTemplateDialog";
import { categoryLabel, templateBody, templateStatusMeta } from "./meta";

interface TemplatesSectionProps {
  templates: MessageTemplate[];
  /** Vuelve a leer la lista tras crear una plantilla. */
  onCreated: () => void;
}

/**
 * Plantillas del WABA: la lista (lectura) y el alta (escritura) que juntas
 * demuestran `whatsapp_business_management`.
 *
 * Se dibuja como lista de tarjetas, no como `<table>`: a 390 px una tabla de
 * cinco columnas obliga a scroll horizontal y el screencast del revisor se
 * graba también en móvil.
 */
export function TemplatesSection({ templates, onCreated }: TemplatesSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <WhatsAppSection
        title="Plantillas de mensaje"
        description="Mensajes aprobados por Meta para escribir fuera de la ventana de 24 h"
        actions={
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          >
            <Plus aria-hidden className="h-3.5 w-3.5" />
            Nueva plantilla
          </button>
        }
      >
        {templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Todavía no hay plantillas"
            description="Crea la primera con «Nueva plantilla»; Meta la revisa antes de habilitarla."
          />
        ) : (
          <ul className="space-y-2">
            {templates.map((template) => {
              const status = templateStatusMeta(template.status);
              const body = templateBody(template);
              return (
                <li
                  key={template.id}
                  className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 break-all font-mono text-sm text-foreground">{template.name}</span>
                    <SemanticBadge label={status.label} className={status.className} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {template.language} · {categoryLabel(template.category)}
                  </p>
                  {body ? (
                    <p className="whitespace-pre-wrap break-words rounded-md border border-border/60 bg-card/60 px-2.5 py-2 text-xs text-muted-foreground">
                      {body}
                    </p>
                  ) : null}
                  {template.status === "REJECTED" && template.rejectedReason ? (
                    <p className="text-xs text-red-700 dark:text-red-300">
                      Motivo del rechazo: {template.rejectedReason}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </WhatsAppSection>

      <NewTemplateDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={onCreated} />
    </>
  );
}
