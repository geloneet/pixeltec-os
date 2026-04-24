"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { LogSource, LogLevel } from "@/lib/crypto-intel/logger";
import type { LogEntrySerialized } from "@/lib/crypto-intel/queries/logs";

interface LogsTileProps {
  logs: LogEntrySerialized[];
}

const SOURCES: Array<{ value: LogSource | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "price-sync", label: "Price Sync" },
  { value: "alert-engine", label: "Alert Engine" },
  { value: "telegram-webhook", label: "Telegram" },
  { value: "admin", label: "Admin" },
];

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
};

export function LogsTile({ logs }: LogsTileProps) {
  const [sourceFilter, setSourceFilter] = useState<LogSource | "all">("all");

  const filtered = logs.filter(
    (l) => sourceFilter === "all" || l.source === sourceFilter
  );

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="mb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          Sistema
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">Logs recientes</h2>
      </div>

      {/* Source filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {SOURCES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSourceFilter(value)}
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              sourceFilter === value
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Scrollable log list */}
      <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="flex h-16 items-center justify-center">
            <p className="text-xs text-zinc-500">Sin logs</p>
          </div>
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2"
            >
              <Badge
                variant="outline"
                className={`mt-0.5 shrink-0 px-1.5 py-0 text-[9px] uppercase ${LEVEL_STYLES[entry.level]}`}
              >
                {entry.level}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-zinc-300">{entry.message}</p>
                <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                  {entry.source} · {formatTimestamp(entry.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
