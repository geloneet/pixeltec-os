"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Brain, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { DefinitionStepper, type StationStatus } from "@/components/definition/DefinitionStepper";
import { StationThread, type ThreadMessage } from "@/components/definition/StationThread";
import { StationComposer } from "@/components/definition/StationComposer";
import { ApproveBar } from "@/components/definition/ApproveBar";
import { SealedStationView } from "@/components/definition/SealedStationView";
import { DefinitionSummary } from "@/components/definition/DefinitionSummary";
import { DefinitionAuditTrail } from "@/components/definition/DefinitionAuditTrail";
import { getStationMeta, STATION_META } from "@/lib/definition/station-meta";
import { stationOrder } from "@/lib/definition/types";
import type { DefinitionStation } from "@/lib/definition/types";
import type { DefinitionViewModel } from "@/components/definition/view-model";
import {
  approveStationAction,
  reopenStationAction,
} from "@/app/(admin)/proyectos/definicion/actions";

interface Props {
  data: DefinitionViewModel;
}

let tmpSeq = 0;
const tmpId = () => `tmp-${tmpSeq++}`;

export function DefinitionWorkspace({ data }: Props) {
  const router = useRouter();
  const active = data.currentStation;
  const activeMeta = getStationMeta(active);
  const activeRow = data.stations.find((s) => s.station === active);

  const statuses = Object.fromEntries(
    data.stations.map((s) => [s.station, s.status])
  ) as Record<DefinitionStation, StationStatus>;

  // Estado local del hilo de la estación activa (se re-siembra al cambiar de
  // estación o tras un refresh del server).
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBrainDump, setShowBrainDump] = useState(false);
  const kickoffFired = useRef<string | null>(null);

  const generate = useCallback(
    async (userMessage?: string) => {
      setGenerating(true);
      setGenError(null);
      if (userMessage) {
        setMessages((prev) => [
          ...prev,
          { id: tmpId(), role: "user", content: userMessage },
        ]);
      }
      try {
        const res = await fetch("/api/definition/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            definitionId: data.id,
            station: active,
            userMessage,
          }),
        });
        // El backend puede seguir trabajando y guardar el resultado aunque
        // nginx corte la conexión (504) antes — en ese caso la respuesta es
        // HTML, no JSON, y res.json() truena con "Unexpected token '<'".
        // Chequeamos res.ok/content-type primero para dar un error claro y
        // reintentable en vez de dejar que ese parseo reviente sin control.
        const contentType = res.headers.get("content-type") ?? "";
        if (!res.ok || !contentType.includes("application/json")) {
          throw new Error(
            res.status === 504
              ? "El servidor tardó demasiado en responder — la generación puede haberse guardado igual. Reintenta o revisa recargando."
              : `No se pudo generar (HTTP ${res.status})`
          );
        }
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "No se pudo generar");
        setMessages((prev) => [
          ...prev,
          { id: tmpId(), role: "assistant", content: json.draft as string },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al generar";
        setGenError(message);
        toast.error(message);
        // Si esto era el auto-kickoff, liberar el guard para poder reintentar
        // (si no, la estación queda sin forma de regenerar sin recargar).
        if (kickoffFired.current === `${data.id}:${active}`) {
          kickoffFired.current = null;
        }
      } finally {
        setGenerating(false);
      }
    },
    [data.id, active]
  );

  // Re-siembra el hilo desde el server al cambiar de estación / tras refresh.
  useEffect(() => {
    if (data.status === "completed") {
      setMessages([]);
      return;
    }
    setGenError(null);
    const seeded = data.messagesByStation[active] ?? [];
    setMessages(seeded);

    // Auto-kickoff: estación activa sin borrador ni historial => primera
    // generación automática (una sola vez por estación).
    const key = `${data.id}:${active}`;
    const hasContent = seeded.length > 0 || !!activeRow?.currentDraft;
    if (!hasContent && kickoffFired.current !== key) {
      kickoffFired.current = key;
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.id, active, data.status]);

  const hasDraft = messages.some((m) => m.role === "assistant");

  const handleApprove = async () => {
    setBusy(true);
    const r = await approveStationAction({ definitionId: data.id, station: active });
    if (!r.success) {
      toast.error(r.error ?? "No se pudo aprobar");
      setBusy(false);
      return;
    }
    toast.success(`${activeMeta.sealName} sellado`);
    router.refresh();
    setBusy(false);
  };

  const handleReopen = async (station: DefinitionStation, reason: string) => {
    const r = await reopenStationAction({ definitionId: data.id, station, reason });
    if (!r.success) {
      toast.error(r.error ?? "No se pudo reabrir");
      return;
    }
    toast.success("Estación reabierta");
    router.refresh();
  };

  // Estaciones ya selladas (para mostrar como documentos congelados).
  const sealedStations = data.stations
    .filter((s) => s.status === "sealed")
    .sort((a, b) => stationOrder(a.station) - stationOrder(b.station));

  const lastSealedOrder = sealedStations.length
    ? Math.max(...sealedStations.map((s) => stationOrder(s.station)))
    : -1;

  const completed = data.status === "completed";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Encabezado */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-zinc-100">{data.title}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          Definición de proyecto · {data.clientName}
        </p>
      </div>

      {/* Stepper — siempre visible */}
      <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-white/[0.06] bg-zinc-950/80 px-4 py-4 backdrop-blur">
        <DefinitionStepper statuses={statuses} current={active} completed={completed} />
      </div>

      {/* Descarga mental original (colapsable) */}
      <button
        type="button"
        onClick={() => setShowBrainDump((v) => !v)}
        className="mb-4 flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-zinc-900/30 px-3 py-2 text-left text-xs text-zinc-400 hover:text-zinc-200"
      >
        {showBrainDump ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Brain className="h-3.5 w-3.5 text-zinc-500" />
        Descarga mental original
      </button>
      {showBrainDump && (
        <div className="mb-6 whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-zinc-900/30 px-4 py-3 text-sm text-zinc-300">
          {data.brainDump}
        </div>
      )}

      {completed ? (
        <DefinitionSummary data={data} onReopen={handleReopen} />
      ) : (
        <div className="space-y-6">
          {/* Estaciones selladas previas (colapsadas) */}
          {sealedStations.map((s) => {
            const meta = getStationMeta(s.station);
            return (
              <SealedStationView
                key={s.station}
                station={s.station}
                title={meta.title}
                sealName={meta.sealName}
                content={s.sealedContent ?? ""}
                sealedAtLabel={s.sealedAt ? formatDate(s.sealedAt) : null}
                sealedByName={s.sealedByName}
                hasDownstream={stationOrder(s.station) < lastSealedOrder || stationOrder(s.station) < stationOrder(active)}
                onReopen={(reason) => handleReopen(s.station, reason)}
              />
            );
          })}

          {/* Estación activa */}
          <div className="rounded-xl border border-cyan-500/20 bg-zinc-900/20 p-5">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-100">
                {activeMeta.title}
              </span>
              {activeRow?.status === "invalidated" && (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                  reabrir upstream la invalidó — regenera
                </span>
              )}
            </div>
            <p className="mb-4 text-xs text-zinc-500">{activeMeta.hint}</p>

            <StationThread messages={messages} generating={generating} />

            {genError && !generating && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                  <p className="text-xs text-amber-300">{genError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => generate()}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reintentar
                </button>
              </div>
            )}

            {hasDraft && !generating && (
              <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-4">
                <StationComposer
                  onSend={(text) => generate(text)}
                  disabled={generating || busy}
                />
                <ApproveBar
                  label={activeMeta.approveLabel}
                  onApprove={handleApprove}
                  disabled={!hasDraft || generating}
                  busy={busy}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {completed && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-300">
          <CheckCircle2 className="h-4 w-4" />
          Proceso completo — los {STATION_META.filter((m) => m.deliverable).length}{" "}
          documentos están sellados y listos para descargar.
        </div>
      )}

      <div className="mt-6">
        <DefinitionAuditTrail events={data.events} />
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
