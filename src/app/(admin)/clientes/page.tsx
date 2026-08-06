"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useCRM } from "@/components/crm/CRMContextCore";
import { useCRMShell } from "@/components/crm/CRMShellProvider";
import { ClientsView } from "@/components/crm/ClientsView";
import { Spinner } from "@/components/ui/spinner";

function CenteredSpinner() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Spinner size="lg" className="text-cyan-400" />
    </div>
  );
}

export default function ClientesPage() {
  const crm = useCRM();
  const shell = useCRMShell();
  const router = useRouter();

  if (crm.loading) {
    return <CenteredSpinner />;
  }

  return (
    // Suspense: ClientsView lee la URL con useSearchParams (estado de
    // filtro/búsqueda/orden) y Next exige el boundary en el prerender.
    <Suspense fallback={<CenteredSpinner />}>
      <ClientsView
        clients={crm.clients}
        navigateToClient={(id) => router.push(`/clientes/${id}`)}
        setModal={shell.setModal}
      />
    </Suspense>
  );
}
