"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContext";
import { useCRMShell } from "@/components/crm/CRMShellProvider";
import { TodayView } from "@/components/crm/TodayView";

export default function HoyPage() {
  const crm = useCRM();
  const shell = useCRMShell();
  const router = useRouter();

  if (crm.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <TodayView
      clients={crm.clients}
      navigateToClient={(id) => router.push(`/clientes/${id}`)}
      navigateToProject={(_cid, pid) => router.push(`/proyectos/${pid}`)}
      setModal={shell.setModal}
      cycleTaskStatus={crm.cycleTaskStatus}
      startPomo={shell.startPomo}
    />
  );
}
