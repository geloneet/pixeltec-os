"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CRMProject } from "@/types/crm";
import { useWorkSession } from "@/hooks/use-work-session";
import { useCRM } from "@/components/crm/CRMContext";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { ActivityWorkspace } from "./ActivityWorkspace";
import { FocusGuard } from "./FocusGuard";
import { QuickNotepad } from "./QuickNotepad";
import { BlockReporter } from "./BlockReporter";
import { EndSessionDialog } from "./EndSessionDialog";
import { SmartSidebar } from "./SmartSidebar";
import { SessionAICoach } from "./SessionAICoach";
import type { CoachResponse } from "@/types/session";

interface Props {
  sessionId: string;
  project: CRMProject;
  onSessionEnd?: (bitacoraEntry: string) => void; // NEW — called after session is persisted
}

export function WorkspaceLayout({ sessionId, project, onSessionEnd }: Props) {
  const router = useRouter();
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [coachResponses, setCoachResponses] = useState<CoachResponse[]>([]);
  const crm = useCRM();
  const ws = useWorkSession(sessionId);

  const handleCoachResponse = useCallback((response: CoachResponse) => {
    setCoachResponses((prev) => [...prev, response]);
  }, []);

  if (!ws.session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Cargando sesión...
      </div>
    );
  }

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

  const task = ws.session ? project.tasks.find(t => t.id === ws.session!.taskId) : null;

  return (
    <div className="flex h-full flex-col bg-[#0F0F12]">
      {/* Header */}
      {ws.session && task && (
        <WorkspaceHeader
          session={ws.session}
          task={task}
          elapsed={ws.elapsed}
          onFinalize={() => setShowEndDialog(true)}
        />
      )}

      {/* Body: main (70%) + sidebar (30%) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main zone — 70% */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-w-0" style={{ maxWidth: "70%" }}>
          <ActivityWorkspace
            activities={ws.session.activities}
            onStart={ws.handleStartActivity}
            onDone={ws.handleActivityDone}
            onUpdateText={(description) => crm.updateCurrentActivity(sessionId, description)}
          />
          <QuickNotepad notes={ws.session.notes} onAddNote={ws.handleAddNote} />
          <BlockReporter
            blockers={ws.session.blockers}
            onAddBlocker={ws.handleAddBlocker}
          />
        </div>

        {/* Smart sidebar — 30% */}
        <div className="w-[30%] flex-shrink-0 overflow-y-auto border-l border-white/[0.04] p-4 space-y-4">
          <SmartSidebar tech={project.tech ?? ""} />
          <SessionAICoach session={ws.session} onResponseAdded={handleCoachResponse} />
        </div>
      </div>

      {/* Overlays */}
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
        coachResponses={coachResponses}
        onConfirm={handleFinalizeConfirmed}
        onCancel={() => setShowEndDialog(false)}
      />
    </div>
  );
}
