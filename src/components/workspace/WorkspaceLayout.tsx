"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { CRMProject, CRMTask } from "@/types/crm";
import { useWorkSession } from "@/hooks/use-work-session";
import { useCRM } from "@/components/crm/CRMContextCore";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { SessionGoals } from "./SessionGoals";
import { ActivityWorkspace } from "./ActivityWorkspace";
import { SessionObservations } from "./SessionObservations";
import { SessionTasksPanel } from "./SessionTasksPanel";
import { BlockTracker } from "./BlockTracker";
import { SessionTimeline } from "./SessionTimeline";
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
  const [blockerPrefill, setBlockerPrefill] = useState<string | null>(null);
  const ws = useWorkSession(sessionId);

  // ── Blocker stats from historical project sessions ─────────────────────────
  const blockerStats = useMemo(() => {
    if (!ws.session) return undefined;
    const projectSessions = crm.getProjectSessions(project.id).filter(
      s => s.id !== sessionId // exclude current session
    );
    const allBlockers = projectSessions.flatMap(s => s.blockers);
    if (allBlockers.length === 0) return { lastBlockerDaysAgo: null, avgBlockMinutes: null };

    // Last blocker date
    const lastTs = allBlockers.reduce((max, b) => {
      const t = new Date(b.createdAt).getTime();
      return t > max ? t : max;
    }, 0);
    const daysDiff = Math.floor((Date.now() - lastTs) / 86_400_000);

    // Average block time (resolved only)
    const resolved = allBlockers.filter(b => b.status === "resolved" && b.resolvedAt);
    const avg = resolved.length > 0
      ? Math.round(
          resolved.reduce((sum, b) => {
            const mins = Math.floor((new Date(b.resolvedAt!).getTime() - new Date(b.createdAt).getTime()) / 60000);
            return sum + mins;
          }, 0) / resolved.length
        )
      : null;

    return { lastBlockerDaysAgo: daysDiff, avgBlockMinutes: avg };
  }, [crm, project.id, sessionId, ws.session]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleFinalizeConfirmed = (
    deployStatus: "yes" | "no" | "na",
    commitStatus: boolean,
    bitacoraEntry: string,
    taskStatus: CRMTask["status"],
  ) => {
    ws.handleEndSession(deployStatus, commitStatus);
    if (ws.session && taskStatus !== task.status) {
      crm.updateTask(ws.session.clientId, ws.session.projectId, task.id, { status: taskStatus });
    }
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

  // Observations → convert to task (formulario real en SessionObservations,
  // ya no se adivina el nombre/prioridad ni se crea a ciegas).
  const handleConvertToTask = useCallback((data: { name: string; desc: string; prio: CRMTask["prio"] }) => {
    if (!ws.session) return;
    crm.addTask(ws.session.clientId, ws.session.projectId, { ...data, sessionId: ws.session.id });
  }, [ws.session, crm]);

  // Observations → create blocker from content: abre el formulario real de
  // BlockTracker pre-llenado en vez de crear con un tipo fijo ("error_api").
  const handleObservationToBlocker = useCallback((content: string) => {
    setBlockerPrefill(content);
  }, []);

  if (!ws.session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Cargando sesión...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <WorkspaceHeader
        session={ws.session}
        task={task}
        elapsed={ws.elapsed}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — 70% */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-w-0" style={{ maxWidth: "73%" }}>
          {/* Mini-timeline — only renders once there is at least one activity */}
          <SessionTimeline session={ws.session} />

          <SessionGoals
            goals={ws.session.sessionGoals ?? []}
            onAdd={ws.handleAddGoal}
            onToggle={ws.handleToggleGoal}
            onRemove={ws.handleRemoveGoal}
            onUpdate={(goalId, text) => crm.updateSessionGoal(sessionId, goalId, text)}
            onReorder={(goalId, dir) => crm.reorderSessionGoal(sessionId, goalId, dir)}
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
            onConvertToTask={handleConvertToTask}
            onCreateBlocker={handleObservationToBlocker}
          />
          <SessionTasksPanel
            tasks={project.tasks.filter((t) => t.sessionId === sessionId)}
            projectId={project.id}
          />
          <BlockTracker
            blockers={ws.session.blockers}
            onAdd={ws.handleAddBlocker}
            onUpdateStatus={ws.handleUpdateBlockerStatus}
            stats={blockerStats}
            prefillDescription={blockerPrefill}
            onPrefillHandled={() => setBlockerPrefill(null)}
          />
        </div>

        {/* Right panel — 27% */}
        <div className="w-[27%] flex-shrink-0 overflow-y-auto border-l border-border">
          <ExecutionAssistant
            session={ws.session}
            project={project}
            elapsed={ws.elapsed}
            onSaveAsObservation={handleSaveAsObservation}
            onSaveToBitacora={handleSaveToBitacora}
            onFinalize={() => setShowEndDialog(true)}
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
        task={task}
        elapsed={ws.elapsed}
        onConfirm={handleFinalizeConfirmed}
        onCancel={() => setShowEndDialog(false)}
      />
    </div>
  );
}
