"use client";

/**
 * Workspace del cliente (ADR-0034): 4 tabs fijos + Portal condicional.
 * Discovery y Estrategia se mudaron a la vista de proyecto (/proyectos/[id])
 * — pertenecen a un trabajo concreto, no al cliente completo. El ciclo
 * comercial (propuestas, contratos, facturación) vive fusionado en Comercial.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CRMClient } from "@/types/crm";
import { ClientDetail } from "./ClientDetail";
import { ProyectosTab } from "@/components/crm/workspace-tabs/ProyectosTab";
import { ComercialTab, type ComercialSub } from "@/components/crm/workspace-tabs/ComercialTab";
import { DocumentosTab } from "@/components/crm/workspace-tabs/DocumentosTab";
import { PortalTab } from "@/components/crm/workspace-tabs/PortalTab";
import { getPortalStatusForClientAction } from "@/lib/client-portal/admin-actions";

export type WorkspaceTab = "resumen" | "proyectos" | "comercial" | "documentos" | "portal";

const BASE_TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "proyectos", label: "Proyectos" },
  { id: "comercial", label: "Comercial" },
  { id: "documentos", label: "Documentos" },
];

type ModalPayload = { type: string; data?: Record<string, string> } | null;

interface Props {
  client: CRMClient;
  onBack: () => void;
  navigateToProject: (clientId: string, projectId: string) => void;
  setModal: (m: ModalPayload) => void;
  deleteClient: (id: string) => void;
  /** Deep-link (?tab=comercial) — p.ej. desde "Crear propuesta" en Definición. */
  initialTab?: WorkspaceTab;
  /** Sub-sección de Comercial (?sub=) — también destino de deep-links legacy. */
  initialSub?: ComercialSub;
}

export function ClientWorkspace({ client, onBack, navigateToProject, setModal, deleteClient, initialTab, initialSub }: Props) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab ?? "resumen");
  // Gate del tab Portal (dictamen 2026-08-05): solo aparece cuando el acceso
  // está habilitado. El blob ya trae portalAccessEnabled; para blobs cargados
  // antes del cambio (undefined) se consulta una vez al montar. Habilitarlo
  // vive en el menú ⋯ del header (ClientDetail → onEnablePortal).
  const [portalEnabled, setPortalEnabled] = useState<boolean>(client.portalAccessEnabled ?? false);

  useEffect(() => {
    if (client.portalAccessEnabled !== undefined) return;
    let cancelled = false;
    getPortalStatusForClientAction(client.id)
      .then((status) => {
        if (!cancelled && status) setPortalEnabled(status.portalAccessEnabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client.id, client.portalAccessEnabled]);

  const tabs = portalEnabled ? [...BASE_TABS, { id: "portal" as const, label: "Portal" }] : BASE_TABS;

  // Si el portal se desactiva mientras su tab está abierto, cae a Resumen.
  useEffect(() => {
    if (activeTab === "portal" && !portalEnabled) setActiveTab("resumen");
  }, [activeTab, portalEnabled]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex-shrink-0 border-b border-border bg-background/40">
        <div className="flex items-center gap-0.5 px-4 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                activeTab === tab.id
                  ? "text-cyan-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400 rounded-t-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "resumen" && (
          <ClientDetail
            client={client}
            setView={(v) => { if (v === "clients") onBack(); }}
            navigateToProject={navigateToProject}
            setModal={setModal}
            deleteClient={deleteClient}
            portalEnabled={portalEnabled}
            onPortalEnabledChange={(enabled) => {
              setPortalEnabled(enabled);
              if (enabled) setActiveTab("portal");
            }}
            onOpenComercial={() => setActiveTab("comercial")}
          />
        )}
        {activeTab === "proyectos" && (
          <ProyectosTab
            client={client}
            navigateToProject={navigateToProject}
            setModal={setModal}
          />
        )}
        {activeTab === "comercial" && (
          <div className="p-6">
            <ComercialTab
              clientId={client.id}
              clientName={client.name}
              clientEmail={client.email}
              initialSub={initialSub}
            />
          </div>
        )}
        {activeTab === "documentos" && (
          <div className="p-6">
            <DocumentosTab clientId={client.id} />
          </div>
        )}
        {activeTab === "portal" && portalEnabled && (
          <div className="p-6">
            <PortalTab clientId={client.id} clientName={client.name} clientEmail={client.email} />
          </div>
        )}
      </div>
    </div>
  );
}
