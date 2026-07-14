"use client";

import { useState } from "react";
import { History, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStationMeta } from "@/lib/definition/station-meta";
import type { WsEvent } from "@/components/definition/view-model";

const EVENT_LABEL: Record<WsEvent["type"], string> = {
  created: "Definición creada",
  started: "Definición iniciada",
  sealed: "Estación sellada",
  reopened: "Estación reabierta",
  invalidated: "Sello invalidado (cambio upstream)",
  converted: "Propuesta generada",
};

const EVENT_COLOR: Record<WsEvent["type"], string> = {
  created: "text-muted-foreground",
  started: "text-muted-foreground",
  sealed: "text-cyan-400",
  reopened: "text-amber-400",
  invalidated: "text-amber-500",
  converted: "text-cyan-400",
};

/** Rastro colapsable de eventos (sellos, reaperturas, invalidaciones, conversión). */
export function DefinitionAuditTrail({ events }: { events: WsEvent[] }) {
  const [open, setOpen] = useState(false);
  if (events.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <History className="h-3.5 w-3.5" />
        Historial ({events.length})
      </button>
      {open && (
        <ul className="space-y-2 border-t border-border px-3 py-3">
          {events.map((e) => (
            <li key={e.id} className="text-[11px] leading-relaxed">
              <span className={cn("font-medium", EVENT_COLOR[e.type])}>
                {EVENT_LABEL[e.type]}
              </span>
              {e.station && (
                <span className="text-muted-foreground/70"> · {getStationMeta(e.station).stepLabel}</span>
              )}
              <span className="text-muted-foreground/70"> · {e.actorName} · {formatDate(e.createdAt)}</span>
              {e.reason && <div className="mt-0.5 text-muted-foreground">“{e.reason}”</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
