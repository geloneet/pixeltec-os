"use client";

import { useParams, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContext";
import { useCRMShell } from "@/components/crm/CRMShellProvider";
import { ClientDetail } from "@/components/crm/ClientDetail";

type LegacyView = "today" | "clients" | "client" | "project" | "search";

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const crm = useCRM();
  const shell = useCRMShell();

  if (crm.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  const client = crm.clients.find((c) => c.id === params.id);

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-zinc-500 text-sm mb-4">Cliente no encontrado</p>
        <button
          onClick={() => router.push("/clientes")}
          className="rounded-lg bg-[#0EA5E9] px-4 py-2 text-sm text-white hover:bg-[#0284C7] transition-all duration-150"
        >
          ← Ver clientes
        </button>
      </div>
    );
  }

  const setView = (v: LegacyView) => {
    if (v === "clients") router.push("/clientes");
    else if (v === "today") router.push("/hoy");
    else if (v === "client") router.push(`/clientes/${client.id}`);
  };

  return (
    <ClientDetail
      client={client}
      setView={setView}
      navigateToProject={(_cid, pid) => router.push(`/proyectos/${pid}`)}
      setModal={shell.setModal}
      deleteClient={crm.deleteClient}
    />
  );
}
