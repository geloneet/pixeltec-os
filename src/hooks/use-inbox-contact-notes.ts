"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContactNote } from "@/types/whatsapp-inbox";

const POLL_INTERVAL_MS = 4000;

/**
 * Reemplaza al `useCollection(notesQuery(...), {listen:true})` duplicado en
 * ContactPanel.tsx y ChatThread.tsx. Mirror exacto de use-inbox-messages.ts:
 * parametrizado por teléfono, resetea el estado al cambiar de `phone`.
 */
export function useInboxContactNotes(phone: string) {
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp-inbox/contacts/${encodeURIComponent(phone)}/notes`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNotes(data.notes ?? []);
      setError(null);
    } catch (err) {
      console.error("useInboxContactNotes error:", err);
      setError(err instanceof Error ? err.message : "unknown");
      // No vaciar notes en error: conserva la última data conocida.
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    hasLoadedRef.current = false;
    setNotes([]);
    setLoading(true);
    setError(null);

    void refetch();
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!interval) interval = setInterval(() => void refetch(), POLL_INTERVAL_MS); };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const onVisibility = () => { if (document.hidden) stop(); else { void refetch(); start(); } };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [refetch]);

  return { notes, loading: loading && !hasLoadedRef.current, error, refetch };
}
