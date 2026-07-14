"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CRMClient } from "@/types/crm";
import { ClientDetail } from "./ClientDetail";
import { ContratosTab } from "@/components/crm/workspace-tabs/ContratosTab";
import { PropuestaTab } from "@/components/crm/workspace-tabs/PropuestaTab";
import { DiscoveryTab } from "@/components/crm/workspace-tabs/DiscoveryTab";
import { EstrategiaTab } from "@/components/crm/workspace-tabs/EstrategiaTab";
import { FacturacionTab } from "@/components/crm/workspace-tabs/FacturacionTab";
import { ProyectosTab } from "@/components/crm/workspace-tabs/ProyectosTab";
import { PortalTab } from "@/components/crm/workspace-tabs/PortalTab";

export type WorkspaceTab =
  | "resumen"
  | "proyectos"
  | "propuesta"
  | "contratos"
  | "documentos"
  | "discovery"
  | "estrategia"
  | "portal";

const WORKSPACE_TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "resumen",    label: "Resumen" },
  { id: "proyectos",  label: "Proyectos" },
  { id: "propuesta",  label: "Propuesta" },
  { id: "contratos",  label: "Contratos" },
  { id: "documentos", label: "Documentos" },
  { id: "discovery",  label: "Discovery" },
  { id: "estrategia", label: "Estrategia" },
  { id: "portal",     label: "Portal" },
];

type ModalPayload = { type: string; data?: Record<string, string> } | null;

interface Props {
  client: CRMClient;
  onBack: () => void;
  navigateToProject: (clientId: string, projectId: string) => void;
  setModal: (m: ModalPayload) => void;
  deleteClient: (id: string) => void;
  /** Deep-link (?tab=propuesta) — p.ej. desde "Crear propuesta" en Definición de Proyecto. */
  initialTab?: WorkspaceTab;
}

function WorkspaceEmptyTab({ label, sprint }: { label: string; sprint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-xs text-muted-foreground">Disponible en {sprint}.</p>
    </div>
  );
}

export function ClientWorkspace({ client, onBack, navigateToProject, setModal, deleteClient, initialTab }: Props) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab ?? "resumen");
  // "Convertir a contrato" en Propuesta: guarda qué propuesta abrir en el
  // wizard prellenado al cambiar a la pestaña Contratos.
  const [pendingContractProposalId, setPendingContractProposalId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex-shrink-0 border-b border-border bg-background/40">
        <div className="flex items-center gap-0.5 px-4 overflow-x-auto scrollbar-none">
          {WORKSPACE_TABS.map((tab) => (
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
          />
        )}
        {activeTab === "proyectos" && (
          <ProyectosTab
            client={client}
            navigateToProject={navigateToProject}
            setModal={setModal}
          />
        )}
        {activeTab === "propuesta"  && (
          <div className="p-6">
            <PropuestaTab
              clientId={client.id}
              clientName={client.name}
              clientEmail={client.email}
              onConvertToContract={(proposalId) => {
                setPendingContractProposalId(proposalId);
                setActiveTab("contratos");
              }}
            />
          </div>
        )}
        {activeTab === "contratos"  && (
          <div className="p-6">
            <ContratosTab
              clientId={client.id}
              clientName={client.name}
              initialProposalId={pendingContractProposalId}
              onConsumedInitialProposal={() => setPendingContractProposalId(null)}
            />
          </div>
        )}
        {activeTab === "documentos" && (
          <div className="p-6">
            <FacturacionTab clientId={client.id} />
          </div>
        )}
        {activeTab === "discovery" && (
          <div className="p-6">
            <DiscoveryTab clientId={client.id} clientName={client.name} />
          </div>
        )}
        {activeTab === "estrategia" && (
          <div className="p-6">
            <EstrategiaTab clientId={client.id} />
          </div>
        )}
        {activeTab === "portal" && (
          <div className="p-6">
            <PortalTab clientId={client.id} clientName={client.name} clientEmail={client.email} />
          </div>
        )}
      </div>
    </div>
  );
}
