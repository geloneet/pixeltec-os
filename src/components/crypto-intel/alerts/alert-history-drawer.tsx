"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { AlertRuleWithId, AlertEventWithId } from "@/lib/crypto-intel/queries/alerts";

interface AlertHistoryDrawerProps {
  alert: AlertRuleWithId | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertHistoryDrawer({ alert, open, onOpenChange }: AlertHistoryDrawerProps) {
  const [events, setEvents] = useState<AlertEventWithId[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !alert) return;
    setLoading(true);
    fetch(`/api/crypto-intel/alerts/${alert.id}/history`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AlertEventWithId[]) => setEvents(data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [open, alert]);

  if (!alert) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-white/[0.06] bg-zinc-950 text-white sm:max-w-lg"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="text-white">
            Historial de disparos
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            {alert.displayName ?? `${alert.symbol} · ${alert.type.replace(/_/g, " ")}`}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-zinc-500">Cargando...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-white/10">
            <p className="text-sm text-zinc-500">Sin disparos registrados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-zinc-400">
                    {formatTimestamp(ev.createdAt)}
                  </span>
                  <div className="flex gap-1">
                    {ev.deliveredTo.map((ch) => (
                      <Badge
                        key={ch}
                        variant="outline"
                        className="border-white/10 px-1.5 py-0 text-[10px] text-zinc-400"
                      >
                        {ch}
                      </Badge>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-zinc-200">{ev.message}</p>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function formatTimestamp(ts: { toMillis?: () => number } | number | null | undefined): string {
  if (!ts) return "—";
  const ms = typeof ts === "number" ? ts : ts.toMillis?.() ?? 0;
  return new Date(ms).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
