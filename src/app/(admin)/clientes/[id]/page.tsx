"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCRM } from "@/components/crm/CRMContextCore";
import { useCRMShell } from "@/components/crm/CRMShellProvider";
import { ClientWorkspace, type WorkspaceTab } from "@/components/crm/ClientWorkspace";
import type { ComercialSub } from "@/components/crm/workspace-tabs/ComercialTab";
import { Spinner } from "@/components/ui/spinner";
import { isClientSectionVisible } from "@/lib/modules/client-workspace";

const VALID_TABS: WorkspaceTab[] = ["resumen", "proyectos", "comercial", "documentos", "portal"];

const VALID_SUBS: ComercialSub[] = ["propuestas", "contratos", "facturacion"];

/** Deep-links previos a ADR-0035 (emails, notificaciones, enlaces guardados):
 *  jamás 404 — cada tab viejo cae en su nuevo hogar. OJO: `documentos` viejo
 *  era facturación; el tab `documentos` nuevo (expediente) solo se alcanza
 *  desde la UI. */
const TAB_MIGRATION: Record<string, { tab: WorkspaceTab; sub?: ComercialSub }> = {
  propuesta: { tab: "comercial", sub: "propuestas" },
  contratos: { tab: "comercial", sub: "contratos" },
  documentos: { tab: "comercial", sub: "facturacion" },
  discovery: { tab: "resumen" },
  estrategia: { tab: "resumen" },
};

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const crm = useCRM();
  const shell = useCRMShell();

  const tabParam = searchParams.get("tab");
  const subParam = searchParams.get("sub");
  const migrated = tabParam ? TAB_MIGRATION[tabParam] : undefined;
  const requestedTab = migrated?.tab ?? VALID_TABS.find((t) => t === tabParam);
  // Deep-link a una sección oculta por el registro (WO-2026-00088): jamás
  // 404 ni pantalla vacía — cae en Resumen.
  const initialTab = requestedTab && isClientSectionVisible(requestedTab) ? requestedTab : undefined;
  const initialSub = migrated?.sub ?? VALID_SUBS.find((s) => s === subParam);

  if (crm.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="lg" className="text-cyan-400" />
      </div>
    );
  }

  const client = crm.clients.find((c) => c.id === params.id);

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm mb-4">Cliente no encontrado</p>
        <button
          onClick={() => router.push("/clientes")}
          className="rounded-lg bg-[#0EA5E9] px-4 py-2 text-sm text-white hover:bg-[#0284C7] transition-all duration-150"
        >
          ← Ver clientes
        </button>
      </div>
    );
  }

  return (
    <ClientWorkspace
      client={client}
      onBack={() => router.push("/clientes")}
      navigateToProject={(_cid, pid) => router.push(`/proyectos/${pid}`)}
      setModal={shell.setModal}
      deleteClient={crm.deleteClient}
      initialTab={initialTab}
      initialSub={initialSub}
    />
  );
}
