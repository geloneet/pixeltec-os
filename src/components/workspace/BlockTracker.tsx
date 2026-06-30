"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import type { SessionBlocker, BlockerType, BlockerStatus, BlockerImpact, BlockerSource } from "@/types/session";
import {
  BLOCKER_LABELS, BLOCKER_STATUS_LABELS, BLOCKER_IMPACT_LABELS, BLOCKER_SOURCE_LABELS,
} from "@/types/session";

interface BlockerStats {
  lastBlockerDaysAgo: number | null;   // null = never
  avgBlockMinutes: number | null;      // null = no resolved blockers
}

interface Props {
  blockers: SessionBlocker[];
  onAdd: (type: BlockerType, description: string, impact: BlockerImpact, source: BlockerSource) => void;
  onUpdateStatus: (blockerId: string, status: BlockerStatus) => void;
  stats?: BlockerStats;
}

const BLOCKER_TYPES: BlockerType[] = ["error_api", "acceso_faltante", "pendiente_cliente", "dependencia_externa"];
const IMPACTS: BlockerImpact[] = ["low", "medium", "high"];
const SOURCES: BlockerSource[] = ["technical", "client", "infrastructure", "third_party", "internal"];

const STATUS_COLORS: Record<BlockerStatus, string> = {
  active:   "text-red-400 border-red-500/20 bg-red-500/[0.04]",
  waiting:  "text-amber-400 border-amber-500/20 bg-amber-500/[0.04]",
  resolved: "text-green-400 border-green-500/10 bg-green-500/[0.03]",
};

const STATUS_ICON: Record<BlockerStatus, { Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  active:   { Icon: AlertCircle,   cls: "text-red-400"   },
  waiting:  { Icon: Clock,         cls: "text-amber-400" },
  resolved: { Icon: CheckCircle2,  cls: "text-green-400" },
};

function formatDuration(startIso: string, endIso?: string): string {
  try {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const mins = Math.floor((end - start) / 60000);
    return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  } catch { return "—"; }
}

function BlockerCard({
  blocker,
  onUpdateStatus,
}: {
  blocker: SessionBlocker;
  onUpdateStatus: (id: string, status: BlockerStatus) => void;
}) {
  const colorClass = STATUS_COLORS[blocker.status];
  const isResolved = blocker.status === "resolved";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: isResolved ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`group rounded-lg border p-3 ${colorClass}`}
    >
      <div className="flex items-start gap-2 mb-1.5">
        {(() => { const { Icon, cls } = STATUS_ICON[blocker.status]; return <Icon className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${cls}`} />; })()}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-zinc-300">{blocker.description}</p>
          <p className="text-[0.65rem] text-zinc-600 mt-0.5">
            {BLOCKER_LABELS[blocker.type]}
            {" · "}
            {BLOCKER_IMPACT_LABELS[blocker.impact]}
            {" · "}
            {blocker.status === "resolved"
              ? `Bloqueó ${formatDuration(blocker.createdAt, blocker.resolvedAt)}`
              : `Bloqueado hace ${formatDuration(blocker.createdAt)}`
            }
          </p>
        </div>
      </div>

      {!isResolved && (
        <div className="flex gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {blocker.status === "active" && (
            <>
              <button
                onClick={() => onUpdateStatus(blocker.id, "waiting")}
                className="rounded px-2 py-0.5 text-[0.65rem] border border-amber-500/20 text-amber-400 hover:bg-amber-500/10 transition-all"
              >
                Poner en espera
              </button>
              <button
                onClick={() => onUpdateStatus(blocker.id, "resolved")}
                className="rounded px-2 py-0.5 text-[0.65rem] border border-green-500/20 text-green-400 hover:bg-green-500/10 transition-all"
              >
                Resolver ✓
              </button>
            </>
          )}
          {blocker.status === "waiting" && (
            <>
              <button
                onClick={() => onUpdateStatus(blocker.id, "active")}
                className="rounded px-2 py-0.5 text-[0.65rem] border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all"
              >
                Volvió a bloquear
              </button>
              <button
                onClick={() => onUpdateStatus(blocker.id, "resolved")}
                className="rounded px-2 py-0.5 text-[0.65rem] border border-green-500/20 text-green-400 hover:bg-green-500/10 transition-all"
              >
                Resolver ✓
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

export function BlockTracker({ blockers, onAdd, onUpdateStatus, stats }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<BlockerType>("error_api");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<BlockerImpact>("medium");
  const [source, setSource] = useState<BlockerSource>("technical");

  const handleSubmit = () => {
    if (!description.trim()) return;
    onAdd(type, description.trim(), impact, source);
    setDescription("");
    setOpen(false);
  };

  const active = blockers.filter(b => b.status === "active");
  const waiting = blockers.filter(b => b.status === "waiting");
  const resolved = blockers.filter(b => b.status === "resolved");
  const isEmpty = active.length === 0 && waiting.length === 0 && resolved.length === 0;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400">
          Bloqueos activos
          {(active.length + waiting.length) > 0 && (
            <span className="ml-2 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-red-400">
              {active.length + waiting.length}
            </span>
          )}
        </p>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-2.5 py-1 text-[0.65rem] font-medium text-red-400 hover:bg-red-500/10 transition-all"
        >
          + Reportar
        </button>
      </div>

      {/* Report form */}
      {open && (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3 space-y-2">
          <select
            value={type}
            onChange={e => setType(e.target.value as BlockerType)}
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 focus:outline-none"
          >
            {BLOCKER_TYPES.map(t => (
              <option key={t} value={t}>{BLOCKER_LABELS[t]}</option>
            ))}
          </select>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
            placeholder="Describe el bloqueo... (solo si impide avanzar más de 2 min)"
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-red-500/30 focus:outline-none transition-colors"
          />
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[0.65rem] text-zinc-600 self-center">Impacto:</span>
            {IMPACTS.map(imp => (
              <button
                key={imp}
                onClick={() => setImpact(imp)}
                className={`rounded px-2 py-0.5 text-[0.65rem] border transition-all ${
                  impact === imp
                    ? "border-zinc-500 text-zinc-200 bg-zinc-700"
                    : "border-transparent text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {BLOCKER_IMPACT_LABELS[imp]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[0.65rem] text-zinc-600 self-center">Origen:</span>
            {SOURCES.map(s => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`rounded px-2 py-0.5 text-[0.65rem] border transition-all ${
                  source === s
                    ? "border-zinc-500 text-zinc-200 bg-zinc-700"
                    : "border-transparent text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {BLOCKER_SOURCE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!description.trim()}
              className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-40"
            >
              Reportar bloqueo
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Empty state with stats */}
      {isEmpty && !open && (
        <div className="py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400/70 flex-shrink-0" />
            <span className="text-xs text-zinc-500">Sin bloqueos activos</span>
          </div>
          {stats ? (
            <div className="space-y-0.5 pl-4">
              {stats.lastBlockerDaysAgo !== null && (
                <p className="text-[0.65rem] text-zinc-700">
                  Último bloqueo:{" "}
                  <span className="text-zinc-600">
                    {stats.lastBlockerDaysAgo === 0
                      ? "hoy (otra sesión)"
                      : stats.lastBlockerDaysAgo === 1
                        ? "hace 1 día"
                        : `hace ${stats.lastBlockerDaysAgo} días`}
                  </span>
                </p>
              )}
              {stats.avgBlockMinutes !== null && (
                <p className="text-[0.65rem] text-zinc-700">
                  Tiempo promedio bloqueado:{" "}
                  <span className="text-zinc-600">{stats.avgBlockMinutes} min</span>
                </p>
              )}
              {stats.lastBlockerDaysAgo === null && (
                <p className="text-[0.65rem] text-zinc-700">Sin bloqueos · todo fluido</p>
              )}
            </div>
          ) : (
            <p className="text-[0.65rem] text-zinc-700 pl-4">Sin bloqueos · todo fluido</p>
          )}
        </div>
      )}

      {/* Active + waiting */}
      {(active.length > 0 || waiting.length > 0) && (
        <div className="space-y-2 mb-2">
          <AnimatePresence>
            {[...active, ...waiting].map(b => (
              <BlockerCard key={b.id} blocker={b} onUpdateStatus={onUpdateStatus} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="space-y-1.5 mt-2 border-t border-white/[0.04] pt-2">
          <p className="text-[0.65rem] text-zinc-700 font-medium uppercase tracking-wider">Resueltos</p>
          <AnimatePresence>
            {resolved.map(b => (
              <BlockerCard key={b.id} blocker={b} onUpdateStatus={onUpdateStatus} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
