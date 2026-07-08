"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InboxMessage } from "@/types/whatsapp-inbox";

const POLL_INTERVAL_MS = 4000;

export function useInboxMessages(phone: string) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp-inbox/conversations/${encodeURIComponent(phone)}/messages`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMessages(data.messages ?? []);
      setError(null);
    } catch (err) {
      console.error("useInboxMessages error:", err);
      setError(err instanceof Error ? err.message : "unknown");
      // No vaciar messages en error: conserva la última data conocida.
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    hasLoadedRef.current = false;
    setMessages([]);
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

  return { messages, loading: loading && !hasLoadedRef.current, error, refetch };
}
