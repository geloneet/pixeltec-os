"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { createProposalFromDefinitionAction } from "@/app/(admin)/proyectos/definicion/actions";

interface Props {
  definitionId: string;
  proposalId: string | null;
  clientCrmId: string;
}

/**
 * Genera la Propuesta comercial a partir de la definición sellada. Server-side
 * puro (a diferencia de la creación de proyectos, `createProposal` no pasa por
 * el contexto CRM client-side — las propuestas no viven en el blob de
 * crm-sync, así que no hay riesgo de reconciliación).
 */
export function CreateProposalButton({ definitionId, proposalId, clientCrmId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (proposalId) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-700 dark:text-cyan-300">
        <CheckCircle2 className="h-4 w-4" />
        Propuesta generada
        <Link
          href={`/clientes/${clientCrmId}?tab=propuesta`}
          className="ml-auto flex items-center gap-1 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-300 transition-colors hover:bg-cyan-500/20"
        >
          Ver propuesta
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    const r = await createProposalFromDefinitionAction({ definitionId });
    if (!r.success || !r.data) {
      toast.error(r.error ?? "No se pudo generar la propuesta");
      setBusy(false);
      return;
    }
    toast.success("Propuesta creada — termínala de llenar en la pestaña Propuesta del cliente");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleCreate}
      disabled={busy}
      className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      Crear propuesta
    </button>
  );
}
