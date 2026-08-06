"use client";

/**
 * Tab Comercial (ADR-0034): fusiona el ciclo comercial completo del cliente —
 * Propuestas, Contratos y Facturación — que antes eran tres tabs de primer
 * nivel. Los componentes internos se montan tal cual; este tab solo aporta el
 * segmented control y conserva el flujo "Convertir a contrato".
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PropuestaTab } from "./PropuestaTab";
import { ContratosTab } from "./ContratosTab";
import { FacturacionTab } from "./FacturacionTab";

export type ComercialSub = "propuestas" | "contratos" | "facturacion";

const SUBS: { id: ComercialSub; label: string }[] = [
  { id: "propuestas", label: "Propuestas" },
  { id: "contratos", label: "Contratos" },
  { id: "facturacion", label: "Facturación" },
];

interface Props {
  clientId: string;
  clientName: string;
  clientEmail: string;
  /** Deep-link (?sub=) — los enlaces legacy ?tab=propuesta caen aquí. */
  initialSub?: ComercialSub;
}

export function ComercialTab({ clientId, clientName, clientEmail, initialSub }: Props) {
  const [sub, setSub] = useState<ComercialSub>(initialSub ?? "propuestas");
  // "Convertir a contrato" desde Propuestas: abre Contratos con el wizard
  // prellenado (antes vivía en ClientWorkspace, cruzando tabs de nivel 1).
  const [pendingContractProposalId, setPendingContractProposalId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-1" role="tablist">
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={sub === s.id}
            onClick={() => setSub(s.id)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
              sub === s.id
                ? "bg-background text-cyan-300 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {sub === "propuestas" && (
        <PropuestaTab
          clientId={clientId}
          clientName={clientName}
          clientEmail={clientEmail}
          onConvertToContract={(proposalId) => {
            setPendingContractProposalId(proposalId);
            setSub("contratos");
          }}
        />
      )}
      {sub === "contratos" && (
        <ContratosTab
          clientId={clientId}
          clientName={clientName}
          initialProposalId={pendingContractProposalId}
          onConsumedInitialProposal={() => setPendingContractProposalId(null)}
        />
      )}
      {sub === "facturacion" && <FacturacionTab clientId={clientId} />}
    </div>
  );
}
