"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WhatsAppContact } from "@/types/whatsapp-inbox";

const POLL_INTERVAL_MS = 4000;

/**
 * Reemplaza a use-whatsapp-contacts.ts (onSnapshot de Firestore) — mismo
 * shape de retorno (Map indexado por teléfono) para que InboxShell no
 * necesite cambios más allá del import. Mirror exacto de
 * use-inbox-conversations.ts: mismo POLL_INTERVAL_MS, mismo pausado/resumido
 * por visibilitychange, nunca vacía los datos en error.
 */
export function useInboxContacts() {
  const [contactsByPhone, setContactsByPhone] = useState<Map<string, WhatsAppContact>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp-inbox/contacts", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const map = new Map<string, WhatsAppContact>();
      (data.contacts ?? []).forEach((contact: WhatsAppContact) => map.set(contact.id, contact));
      setContactsByPhone(map);
      setError(null);
    } catch (err) {
      console.error("useInboxContacts error:", err);
      setError(err instanceof Error ? err.message : "unknown");
      // No vaciar contactsByPhone en error: conserva la última data conocida.
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

  return { contactsByPhone, loading: loading && !hasLoadedRef.current, error, refetch };
}
