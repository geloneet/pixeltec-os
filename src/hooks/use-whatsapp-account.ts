"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountResponse } from "@/lib/whatsapp/management-types";

/**
 * Número y perfil de empresa de WhatsApp Business (`GET /account`, WO-2026-00181).
 *
 * A diferencia de `use-inbox-*`, **no hay polling**: el número y el perfil no
 * cambian mientras el revisor mira la pantalla, y una request cada 4 s contra
 * Graph gastaría cuota de la API por nada.
 *
 * `configured:false` NO es un error: viaja dentro de `account` para que la
 * vista dibuje la tarjeta «No configurado» con las env que faltan. Solo un
 * fallo real de red o un status de error llenan `error`.
 */
export function useWhatsAppAccount() {
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp-inbox/account", { cache: "no-store" });
      const data = (await res.json()) as AccountResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setAccount(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer la cuenta de WhatsApp.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { account, loading, error, refetch };
}
