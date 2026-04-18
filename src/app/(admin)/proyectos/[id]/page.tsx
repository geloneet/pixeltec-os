"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContext";
import { useCRMShell } from "@/components/crm/CRMShellProvider";
import { ProjectView } from "@/components/crm/ProjectView";

type LegacyView = "today" | "clients" | "client" | "project" | "search";

export default function ProyectoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const crm = useCRM();
  const shell = useCRMShell();

  if (crm.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  let foundClient = null;
  let foundProject = null;
  for (const c of crm.clients) {
    const p = c.projects.find((pp) => pp.id === params.id);
    if (p) {
      foundClient = c;
      foundProject = p;
      break;
    }
  }

  if (!foundClient || !foundProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-zinc-500 text-sm mb-4">Proyecto no encontrado</p>
        <button
          onClick={() => router.push("/clientes")}
          className="rounded-lg bg-[#0EA5E9] px-4 py-2 text-sm text-white hover:bg-[#0284C7] transition-all duration-150"
        >
          ← Ver clientes
        </button>
      </div>
    );
  }

  const projectTab = searchParams.get("tab") || "tareas";
  const setProjectTab = (t: string) => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("tab", t);
    router.replace(`/proyectos/${params.id}?${qs.toString()}`);
  };

  const setView = (v: LegacyView) => {
    if (v === "clients") router.push("/clientes");
    else if (v === "today") router.push("/hoy");
    else if (v === "client") router.push(`/clientes/${foundClient!.id}`);
    else if (v === "project") router.push(`/proyectos/${foundProject!.id}`);
  };

  return (
    <ProjectView
      client={foundClient}
      project={foundProject}
      projectTab={projectTab}
      setProjectTab={setProjectTab}
      setView={setView}
      setModal={shell.setModal}
      cycleTaskStatus={crm.cycleTaskStatus}
      deleteTask={crm.deleteTask}
      deleteKey={crm.deleteKey}
      deleteProject={crm.deleteProject}
      saveQuickNote={crm.saveQuickNote}
      startPomo={shell.startPomo}
      pomoRunning={shell.pomoRunning}
      pomoTaskRef={shell.pomoTaskRef}
      pomoSeconds={shell.pomoSeconds}
      pomoMode={shell.pomoMode}
      pomoSessions={shell.pomoSessions}
      stopPomo={shell.stopPomo}
      resetPomo={shell.resetPomo}
      deleteCharge={crm.deleteCharge}
      updateCharge={crm.updateCharge}
    />
  );
}
