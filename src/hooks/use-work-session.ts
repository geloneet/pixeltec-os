"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCRM } from "@/components/crm/CRMContextCore";
import type { BlockerType, BlockerImpact, BlockerSource, ObservationType, BlockerStatus } from "@/types/session";

export function useWorkSession(sessionId: string) {
  const crm = useCRM();
  const session = crm.sessions.find((s) => s.id === sessionId) ?? null;

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(() => {
    if (!session) return 0;
    return Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
  });

  useEffect(() => {
    if (!session) return;
    const start = new Date(session.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Activities ─────────────────────────────────────────────────────────────
  const [activityText, setActivityText] = useState(
    () => session?.currentActivity ?? ""
  );

  useEffect(() => {
    setActivityText(session?.currentActivity ?? "");
  }, [session?.currentActivity]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartActivity = useCallback(
    (description: string, estimatedMinutes?: number) => {
      if (!description.trim()) return;
      crm.startActivity(sessionId, description.trim(), estimatedMinutes);
      setActivityText(description.trim());
    },
    [sessionId, crm]
  );

  const handleActivityUpdate = useCallback(() => {
    if (!activityText.trim()) return;
    crm.updateCurrentActivity(sessionId, activityText.trim());
  }, [sessionId, activityText, crm]);

  const handleUpdateActivityText = useCallback(
    (description: string) => {
      if (!description.trim()) return;
      crm.updateCurrentActivity(sessionId, description.trim());
      setActivityText(description.trim());
    },
    [sessionId, crm]
  );

  const handleActivityDone = useCallback(() => {
    if (activityText.trim()) {
      crm.updateCurrentActivity(sessionId, activityText.trim());
    }
    crm.completeActivity(sessionId);
    setActivityText("");
  }, [sessionId, activityText, crm]);

  // ── Goals ──────────────────────────────────────────────────────────────────
  const handleAddGoal = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      crm.addSessionGoal(sessionId, text.trim());
    },
    [sessionId, crm]
  );

  const handleToggleGoal = useCallback(
    (goalId: string) => {
      crm.toggleSessionGoal(sessionId, goalId);
    },
    [sessionId, crm]
  );

  const handleRemoveGoal = useCallback(
    (goalId: string) => {
      crm.removeSessionGoal(sessionId, goalId);
    },
    [sessionId, crm]
  );

  // ── Notes (Observations) ───────────────────────────────────────────────────
  const handleAddNote = useCallback(
    (type: ObservationType, content: string) => {
      if (!content.trim()) return;
      crm.addSessionNote(sessionId, type, content.trim());
    },
    [sessionId, crm]
  );

  const handleMarkNoteForSummary = useCallback(
    (noteId: string) => {
      crm.markNoteForSummary(sessionId, noteId);
    },
    [sessionId, crm]
  );

  // ── Blockers ───────────────────────────────────────────────────────────────
  const handleAddBlocker = useCallback(
    (type: BlockerType, description: string, impact: BlockerImpact, source: BlockerSource) => {
      crm.addSessionBlocker(sessionId, type, description, impact, source);
    },
    [sessionId, crm]
  );

  const handleUpdateBlockerStatus = useCallback(
    (blockerId: string, status: BlockerStatus) => {
      crm.updateBlockerStatus(sessionId, blockerId, status);
    },
    [sessionId, crm]
  );

  // ── End session ────────────────────────────────────────────────────────────
  const handleEndSession = useCallback(
    (deployStatus: "yes" | "no" | "na", commitStatus: boolean) => {
      crm.endSession(sessionId, deployStatus, commitStatus);
    },
    [sessionId, crm]
  );

  // ── Inactivity guard (20 min) ──────────────────────────────────────────────
  const [showInactiveAlert, setShowInactiveAlert] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const INACTIVE_MS = 20 * 60 * 1000;

  useEffect(() => {
    if (!session || session.status !== "active") return;
    const reset = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("mousemove", reset, { passive: true });
    window.addEventListener("keydown", reset, { passive: true });
    window.addEventListener("click", reset, { passive: true });
    const check = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVE_MS) {
        setShowInactiveAlert(true);
      }
    }, 60_000);
    return () => {
      window.removeEventListener("mousemove", reset);
      window.removeEventListener("keydown", reset);
      window.removeEventListener("click", reset);
      clearInterval(check);
    };
  }, [session?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    session,
    elapsed,
    activityText,
    setActivityText,
    handleStartActivity,
    handleActivityUpdate,
    handleUpdateActivityText,
    handleActivityDone,
    handleAddGoal,
    handleToggleGoal,
    handleRemoveGoal,
    handleAddNote,
    handleMarkNoteForSummary,
    handleAddBlocker,
    handleUpdateBlockerStatus,
    handleEndSession,
    showInactiveAlert,
    setShowInactiveAlert,
  };
}
