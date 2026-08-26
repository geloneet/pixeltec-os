"use client";

/**
 * Carga las cotizaciones del cliente para la pestaña (WO-2026-00102).
 *
 * El workspace es un Client Component, así que los datos llegan por Server
 * Action y no por props del servidor. Se aísla aquí para que
 * `CotizacionesTab` siga siendo una pantalla tonta y testeable.
 */
import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { listQuotesAction } from "@/lib/quotes/actions";
import { CotizacionesTab, type QuoteView } from "./CotizacionesTab";

export function CotizacionesTabLoader({
  clientId,
  clientName,
  clientEmail,
  clientPhone,
}: {
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
}) {
  const [quotes, setQuotes] = useState<QuoteView[] | null>(null);

  const load = useCallback(async () => {
    const res = await listQuotesAction(clientId);
    setQuotes(res.ok && res.data ? (res.data.quotes as QuoteView[]) : []);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (quotes === null) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <CotizacionesTab
      clientId={clientId}
      clientName={clientName}
      clientEmail={clientEmail}
      clientPhone={clientPhone}
      quotes={quotes}
      siteUrl={typeof window !== "undefined" ? window.location.origin : ""}
      onChanged={() => void load()}
    />
  );
}
