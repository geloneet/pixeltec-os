"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CRMProject, CRMTask } from "@/types/crm";
import { useWorkSession } from "@/hooks/use-work-session";
import { useCRM } from "@/components/crm/CRMContextCore";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { SessionGoals } from "./SessionGoals";
import { ActivityWorkspace } from "./ActivityWorkspace";
import { SessionObservations } from "./SessionObservations";
import { BlockTracker } from "./BlockTracker";
import { FocusGuard } from "./FocusGuard";
import { EndSessionDialog } from "./EndSessionDialog";
import { ExecutionAssistant } from "./ExecutionAssistant";
import { useState } from "react";

interface Props {
  sessionId: string;
  project: CRMProject;
  task: CRMTask;
  onSessionEnd?: (bitacoraEntry: string) => void;
}

export function WorkspaceLayout({ sessionId, project, task, onSessionEnd }: Props) {
  const router = useRouter();
  const crm = useCRM();
  const [showEndDialog, setShowEndDialog] = useState(false);
  const ws = useWorkSession(sessionId);

  const handleFinalizeConfirmed = (
    deployStatus: "yes" | "no" | "na",
    commitStatus: boolean,
    bitacoraEntry: string,
  ) => {
    ws.handleEndSession(deployStatus, commitStatus);
    setShowEndDialog(false);
    if (bitacoraEntry.trim()) {
      onSessionEnd?.(bitacoraEntry);
    }
    router.push(`/proyectos/${project.id}?tab=tareas`);
  };

  const handleSaveAsObservation = useCallback((content: string) => {
    ws.handleAddNote("decision", content);
  }, [ws]);

  const handleSaveToBitacora = useCallback((content: string) => {
    if (!ws.session) return;
    crm.addProjectLogEntry(
      ws.session.clientId,
      ws.session.projectId,
      {
        category: "Desarrollo",
        content,
        authorName: crm.userEmail ?? "Miguel",
        createdAt: new Date().toISOString(),
      }
    );
  }, [ws.session, crm]);

  if (!ws.session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Cargando sesión...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0F0F12]">
      <WorkspaceHeader
        session={ws.session}
        task={task}
        elapsed={ws.elapsed}
        onFinalize={() => setShowEndDialog(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — 70% */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-w-0" style={{ maxWidth: "70%" }}>
          <SessionGoals
            goals={ws.session.sessionGoals ?? []}
            onAdd={ws.handleAddGoal}
            onToggle={ws.handleToggleGoal}
            onRemove={ws.handleRemoveGoal}
          />
          <ActivityWorkspace
            activities={ws.session.activities}
            onStart={ws.handleStartActivity}
            onDone={ws.handleActivityDone}
            onUpdateText={ws.handleUpdateActivityText}
          />
          <SessionObservations
            notes={ws.session.notes}
            onAdd={ws.handleAddNote}
            onMarkForSummary={ws.handleMarkNoteForSummary}
          />
          <BlockTracker
            blockers={ws.session.blockers}
            onAdd={ws.handleAddBlocker}
            onUpdateStatus={ws.handleUpdateBlockerStatus}
          />
        </div>

        {/* Right panel — 30% */}
        <div className="w-[30%] flex-shrink-0 overflow-y-auto border-l border-white/[0.04]">
          <ExecutionAssistant
            session={ws.session}
            project={project}
            elapsed={ws.elapsed}
            onSaveAsObservation={handleSaveAsObservation}
            onSaveToBitacora={handleSaveToBitacora}
          />
        </div>
      </div>

      <FocusGuard
        open={ws.showInactiveAlert}
        onContinue={() => ws.setShowInactiveAlert(false)}
        onChangeActivity={() => {
          ws.setShowInactiveAlert(false);
          ws.handleActivityDone();
        }}
        onPause={() => ws.setShowInactiveAlert(false)}
      />

      <EndSessionDialog
        open={showEndDialog}
        session={ws.session}
        elapsed={ws.elapsed}
        onConfirm={handleFinalizeConfirmed}
        onCancel={() => setShowEndDialog(false)}
      />
    </div>
  );
}
