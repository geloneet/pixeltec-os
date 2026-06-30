"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { CRMProject, CRMTask } from "@/types/crm";
import type { BlockerType, BlockerImpact, BlockerSource } from "@/types/session";
import { useWorkSession } from "@/hooks/use-work-session";
import { useCRM } from "@/components/crm/CRMContextCore";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { SessionGoals } from "./SessionGoals";
import { ActivityWorkspace } from "./ActivityWorkspace";
import { SessionObservations } from "./SessionObservations";
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

  // Observations → convert to task
  const handleConvertToTask = useCallback((content: string) => {
    if (!ws.session) return;
    crm.addTask(ws.session.clientId, ws.session.projectId, {
      name: content.length > 60 ? content.slice(0, 58).trimEnd() + "…" : content,
      desc: content,
      prio: "low",
    });
  }, [ws.session, crm]);

  // Observations → create blocker from content
  const handleObservationToBlocker = useCallback((content: string) => {
    if (!ws.session) return;
    const desc = content.length > 120 ? content.slice(0, 118).trimEnd() + "…" : content;
    ws.handleAddBlocker(
      "error_api" as BlockerType,
      desc,
      "medium" as BlockerImpact,
      "technical" as BlockerSource,
    );
  }, [ws]);

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
          <BlockTracker
            blockers={ws.session.blockers}
            onAdd={ws.handleAddBlocker}
            onUpdateStatus={ws.handleUpdateBlockerStatus}
            stats={blockerStats}
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
