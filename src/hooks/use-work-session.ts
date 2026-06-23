"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCRM } from "@/components/crm/CRMContext";
import type { BlockerType } from "@/types/session";

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
    const tick = () =>
      setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Activity text (local state, synced from session.currentActivity) ───────
  const [activityText, setActivityText] = useState(
    () => session?.currentActivity ?? ""
  );

  useEffect(() => {
    setActivityText(session?.currentActivity ?? "");
  }, [session?.currentActivity]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleActivityUpdate = useCallback(() => {
    if (!activityText.trim()) return;
    crm.updateCurrentActivity(sessionId, activityText.trim());
  }, [sessionId, activityText, crm]);

  const handleActivityDone = useCallback(() => {
    crm.completeActivity(sessionId);
    setActivityText("");
  }, [sessionId, crm]);

  // ── Notes ──────────────────────────────────────────────────────────────────
  const handleAddNote = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      crm.addSessionNote(sessionId, content.trim());
    },
    [sessionId, crm]
  );

  // ── Blockers ───────────────────────────────────────────────────────────────
  const handleAddBlocker = useCallback(
    (type: BlockerType, description: string) => {
      crm.addSessionBlocker(sessionId, type, description);
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

    const reset = () => {
      lastActivityRef.current = Date.now();
    };

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
    handleActivityUpdate,
    handleActivityDone,
    handleAddNote,
    handleAddBlocker,
    handleEndSession,
    showInactiveAlert,
    setShowInactiveAlert,
  };
}
