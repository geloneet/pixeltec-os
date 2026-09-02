"use client";

import { useCallback, useEffect, useState } from "react";
import type { MessageTemplate, TemplatesResponse } from "@/lib/whatsapp/management-types";

/**
 * Plantillas de mensaje del WABA (`GET /templates`, WO-2026-00181).
 *
 * Mismo criterio que `use-whatsapp-account`: sin polling, y `configured:false`
 * se propaga como dato (no como error) para que la vista lo explique.
 *
 * `refetch` es la pieza que cierra el flujo que Meta exige ver: tras crear una
 * plantilla, la lista vuelve a leerse y la nueva aparece «En revisión».
 */
export function useWhatsAppTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp-inbox/templates", { cache: "no-store" });
      const data = (await res.json()) as TemplatesResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setTemplates(data.templates ?? []);
      setConfigured(data.configured);
      setMissing(data.missing ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las plantillas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { templates, configured, missing, loading, error, refetch };
}
