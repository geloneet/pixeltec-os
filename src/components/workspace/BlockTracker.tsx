"use client";

import { useState, useEffect } from "react";
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
  /** Pre-llena y abre el formulario de reporte — usado por "Crear bloqueo" desde una observación. */
  prefillDescription?: string | null;
  onPrefillHandled?: () => void;
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
          <p className="text-xs font-medium text-foreground">{blocker.description}</p>
          <p className="text-[0.65rem] text-muted-foreground/70 mt-0.5">
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

export function BlockTracker({ blockers, onAdd, onUpdateStatus, stats, prefillDescription, onPrefillHandled }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<BlockerType>("error_api");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<BlockerImpact>("medium");
  const [source, setSource] = useState<BlockerSource>("technical");

  // "Crear bloqueo" desde una observación — abre este mismo formulario
  // pre-llenado en vez de crear el bloqueo a ciegas con un tipo fijo.
  useEffect(() => {
    if (!prefillDescription) return;
    setDescription(prefillDescription);
    setType("error_api");
    setImpact("medium");
    setSource("technical");
    setOpen(true);
    onPrefillHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillDescription]);

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
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground">
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
        <div className="mb-3 rounded-lg border border-border bg-secondary/40 p-3 space-y-2">
          <select
            value={type}
            onChange={e => setType(e.target.value as BlockerType)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none"
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
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-red-500/30 focus:outline-none transition-colors"
          />
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[0.65rem] text-muted-foreground/70 self-center">Impacto:</span>
            {IMPACTS.map(imp => (
              <button
                key={imp}
                onClick={() => setImpact(imp)}
                className={`rounded px-2 py-0.5 text-[0.65rem] border transition-all ${
                  impact === imp
                    ? "border-border text-foreground bg-secondary"
                    : "border-transparent text-muted-foreground/70 hover:text-muted-foreground"
                }`}
              >
                {BLOCKER_IMPACT_LABELS[imp]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[0.65rem] text-muted-foreground/70 self-center">Origen:</span>
            {SOURCES.map(s => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`rounded px-2 py-0.5 text-[0.65rem] border transition-all ${
                  source === s
                    ? "border-border text-foreground bg-secondary"
                    : "border-transparent text-muted-foreground/70 hover:text-muted-foreground"
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
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Empty state with stats */}
      {isEmpty && !open && (
        <div className="py-1">
          {/* Status row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400/80 flex-shrink-0" />
              <div>
                <p className="text-xs text-foreground font-medium">Todo despejado</p>
                <p className="text-[0.65rem] text-muted-foreground/70">0 bloqueos activos</p>
              </div>
            </div>
          </div>
          {/* Stats grid */}
          {stats && stats.lastBlockerDaysAgo !== null ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-secondary/40 border border-border px-3 py-2">
                <p className="text-[0.6rem] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Último bloqueo</p>
                <p className="text-xs text-muted-foreground">
                  {stats.lastBlockerDaysAgo === 0
                    ? "Hoy"
                    : stats.lastBlockerDaysAgo === 1
                      ? "Hace 1 día"
                      : `Hace ${stats.lastBlockerDaysAgo} días`}
                </p>
              </div>
              <div className="rounded-lg bg-secondary/40 border border-border px-3 py-2">
                <p className="text-[0.6rem] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Promedio bloqueado</p>
                <p className="text-xs text-muted-foreground">
                  {stats.avgBlockMinutes !== null ? `${stats.avgBlockMinutes} min` : "—"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[0.65rem] text-muted-foreground/60">Sin historial de bloqueos · flujo limpio</p>
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
        <div className="space-y-1.5 mt-2 border-t border-border pt-2">
          <p className="text-[0.65rem] text-muted-foreground/60 font-medium uppercase tracking-wider">Resueltos</p>
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
