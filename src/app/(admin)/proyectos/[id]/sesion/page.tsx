"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useCRM } from "@/components/crm/CRMContextCore";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import type { CRMClient, CRMProject, CRMTask } from "@/types/crm";
import { Spinner } from "@/components/ui/spinner";

export default function SesionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const crm = useCRM();

  const taskId = searchParams.get("taskId") ?? "";

  if (crm.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="lg" className="text-cyan-400" />
      </div>
    );
  }

  let client: CRMClient | null = null;
  let project: CRMProject | null = null;
  let task: CRMTask | null = null;
  for (const c of crm.clients) {
    const p = c.projects.find(pp => pp.id === params.id);
    if (p) {
      client = c;
      project = p;
      task = p.tasks.find(t => t.id === taskId) ?? null;
      break;
    }
  }

  if (!client || !project || !task) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm mb-4">Tarea no encontrada</p>
        <button
          onClick={() => router.push(`/proyectos/${params.id}?tab=tareas`)}
          className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20 transition-all"
        >
          ← Volver al proyecto
        </button>
      </div>
    );
  }

  return (
    <SesionPageInner
      client={client}
      project={project}
      task={task}
    />
  );
}

function SesionPageInner({
  client,
  project,
  task,
}: {
  client: CRMClient;
  project: CRMProject;
  task: CRMTask;
}) {
  const crm = useCRM();
  const sessionStarted = useRef(false);

  const activeSession = crm.sessions.find(
    s => s.projectId === project.id && s.taskId === task.id && s.status === "active"
  );

  useEffect(() => {
    if (!sessionStarted.current && !activeSession) {
      sessionStarted.current = true;
      crm.startSession(client.id, project.id, task.id, client.name, project.name, task.name);
    }
  }, [activeSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSessionEnd = useCallback(
    (bitacoraEntry: string) => {
      crm.addProjectLogEntry(client.id, project.id, {
        category: "Desarrollo",
        content: bitacoraEntry,
        authorName: crm.userEmail ?? "Miguel",
        createdAt: new Date().toISOString(),
      });
    },
    [crm, client.id, project.id]
  );

  if (!activeSession) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="lg" className="text-cyan-400" />
      </div>
    );
  }

  return <WorkspaceLayout sessionId={activeSession.id} project={project} task={task} onSessionEnd={handleSessionEnd} />;
}
