"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BotMemoryEntry } from "@/types/whatsapp-inbox";

/**
 * Memoria del bot para un contacto — read-only, GET /api/whatsapp-inbox/memory?phone=.
 * Mirror de use-inbox-contact-notes.ts pero sin polling: a diferencia de notas/mensajes,
 * la memoria del bot no cambia mientras el admin tiene el panel abierto viéndola.
 */
export function useInboxBotMemory(phone: string) {
  const [memory, setMemory] = useState<BotMemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp-inbox/memory?phone=${encodeURIComponent(phone)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMemory(data.memory ?? []);
      setError(null);
    } catch (err) {
      console.error("useInboxBotMemory error:", err);
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    hasLoadedRef.current = false;
    setMemory([]);
    setLoading(true);
    setError(null);
    void refetch();
  }, [refetch]);

  return { memory, loading: loading && !hasLoadedRef.current, error, refetch };
}
