"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderPlus, Loader2, CheckCircle2 } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContextCore";
import { markConvertedAction } from "@/app/(admin)/proyectos/definicion/actions";

interface Props {
  definitionId: string;
  title: string;
  clientCrmId: string;
  convertedProjectCrmId: string | null;
}

/**
 * Convierte la definición en un proyecto CRM. CLAVE: crea el proyecto vía el
 * contexto CRM client-side (mismo camino que el modal) — NUNCA por repo — para
 * no chocar con la reconciliación de blob de crm-sync (que borraría/duplicaría
 * un insert directo). Ver plan §5.
 */
export function ConvertToProjectButton({
  definitionId,
  title,
  clientCrmId,
  convertedProjectCrmId,
}: Props) {
  const crm = useCRM();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (convertedProjectCrmId) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-300">
        <CheckCircle2 className="h-4 w-4" />
        Ya convertido a proyecto CRM
      </div>
    );
  }

  const handleConvert = async () => {
    if (crm.loading || busy) return;
    setBusy(true);
    try {
      const projectId = crm.addProject(clientCrmId, {
        name: title,
        domain: "",
        budget: 0,
        annual: 0,
        budgetIva: "none",
        annualIva: "none",
        tech: "",
      });
      if (!projectId) {
        // addProject ya mostró el toast de validación.
        setBusy(false);
        return;
      }
      const r = await markConvertedAction({ definitionId, projectCrmId: projectId });
      if (!r.success) {
        toast.error(r.error ?? "No se pudo registrar la conversión");
        setBusy(false);
        return;
      }
      toast.success("Proyecto creado en el CRM");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al convertir");
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleConvert}
      disabled={crm.loading || busy}
      className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
      {crm.loading ? "Cargando CRM…" : "Convertir en proyecto CRM"}
    </button>
  );
}
