"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InboxConversation } from "@/types/whatsapp-inbox";

const POLL_INTERVAL_MS = 4000;

export function useInboxConversations() {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp-inbox/conversations", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setConversations(data.conversations ?? []);
      setError(null);
    } catch (err) {
      console.error("useInboxConversations error:", err);
      setError(err instanceof Error ? err.message : "unknown");
      // No vaciar conversations en error: conserva la última data conocida.
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!interval) interval = setInterval(() => void refetch(), POLL_INTERVAL_MS); };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const onVisibility = () => { if (document.hidden) stop(); else { void refetch(); start(); } };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [refetch]);

  return { conversations, loading: loading && !hasLoadedRef.current, error, refetch };
}
