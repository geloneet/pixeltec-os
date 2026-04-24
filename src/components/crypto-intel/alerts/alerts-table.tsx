"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, Pencil, Clock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertEditDrawer } from "./alert-edit-drawer";
import { AlertHistoryDrawer } from "./alert-history-drawer";
import { DeleteAlertDialog } from "./delete-alert-dialog";
import { toggleAlert } from "@/lib/crypto-intel/actions/alerts";
import type { AlertRuleSerialized } from "@/lib/crypto-intel/queries/alerts";
import { WATCHLIST } from "@/lib/crypto-intel/watchlist";

interface AlertsTableProps {
  initialAlerts: AlertRuleSerialized[];
}

type StatusFilter = "all" | "active" | "paused";
type ChannelFilter = "all" | "telegram" | "dashboard";

export function AlertsTable({ initialAlerts }: AlertsTableProps) {
  const [alerts, setAlerts] = useState<AlertRuleSerialized[]>(initialAlerts);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [symbolFilter, setSymbolFilter] = useState<string>("all");

  const [editAlert, setEditAlert] = useState<AlertRuleSerialized | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [historyAlert, setHistoryAlert] = useState<AlertRuleSerialized | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AlertRuleSerialized | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (statusFilter === "active" && !a.active) return false;
      if (statusFilter === "paused" && a.active) return false;
      if (channelFilter !== "all" && !a.channels.includes(channelFilter)) return false;
      if (symbolFilter !== "all" && a.symbol !== symbolFilter) return false;
      return true;
    });
  }, [alerts, statusFilter, channelFilter, symbolFilter]);

  async function handleToggle(alert: AlertRuleSerialized, newActive: boolean) {
    setTogglingIds((prev) => new Set(prev).add(alert.id));
    // Optimistic update
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, active: newActive } : a))
    );
    try {
      const result = await toggleAlert(alert.id, newActive);
      if (!result.ok) {
        // Revert
        setAlerts((prev) =>
          prev.map((a) => (a.id === alert.id ? { ...a, active: !newActive } : a))
        );
        toast.error(result.error ?? "Error al actualizar");
      } else {
        toast.success(newActive ? "Alerta activada" : "Alerta pausada");
      }
    } catch {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, active: !newActive } : a))
      );
      toast.error("Error inesperado");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(alert.id);
        return next;
      });
    }
  }

  function handleDeleted(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function openEdit(alert: AlertRuleSerialized) {
    setEditAlert(alert);
    setEditOpen(true);
  }

  function openHistory(alert: AlertRuleSerialized) {
    setHistoryAlert(alert);
    setHistoryOpen(true);
  }

  function openDelete(alert: AlertRuleSerialized) {
    setDeleteTarget(alert);
    setDeleteOpen(true);
  }

  const symbols = Array.from(new Set(WATCHLIST.map((w) => w.symbol)));

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={symbolFilter} onValueChange={setSymbolFilter}>
          <SelectTrigger className="w-36 border-white/10 bg-white/[0.04] text-sm text-white">
            <SelectValue placeholder="Todos los assets" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-zinc-900 text-white">
            <SelectItem value="all">Todos los assets</SelectItem>
            {symbols.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-36 border-white/10 bg-white/[0.04] text-sm text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-zinc-900 text-white">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="paused">Pausadas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as ChannelFilter)}>
          <SelectTrigger className="w-36 border-white/10 bg-white/[0.04] text-sm text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-zinc-900 text-white">
            <SelectItem value="all">Todos los canales</SelectItem>
            <SelectItem value="telegram">Telegram</SelectItem>
            <SelectItem value="dashboard">Dashboard</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto font-mono text-xs text-zinc-500">
          {filtered.length} alerta{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-zinc-400">No hay alertas que coincidan con los filtros</p>
          <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500">
            <Link href="/crypto-intel/alertas/nueva">
              <Plus className="mr-1.5 h-4 w-4" />
              Nueva alerta
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-zinc-400">Asset</TableHead>
                <TableHead className="text-zinc-400">Condición</TableHead>
                <TableHead className="text-zinc-400">Umbral</TableHead>
                <TableHead className="text-zinc-400">Canales</TableHead>
                <TableHead className="text-zinc-400">Estado</TableHead>
                <TableHead className="text-zinc-400">Último disparo</TableHead>
                <TableHead className="text-zinc-400">Cooldown</TableHead>
                <TableHead className="text-right text-zinc-400">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((alert) => (
                <TableRow
                  key={alert.id}
                  className="border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-sm font-semibold text-white">
                        {alert.symbol}
                      </span>
                      {alert.displayName && (
                        <span className="text-[11px] text-zinc-500 truncate max-w-[120px]">
                          {alert.displayName}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ConditionBadge type={alert.type} />
                  </TableCell>
                  <TableCell className="font-mono text-sm text-zinc-300">
                    {alert.type === "change_percent"
                      ? `${alert.params.threshold}% (${alert.params.window ?? "24h"}, ${alert.params.direction ?? "down"})`
                      : `$${alert.params.threshold?.toLocaleString() ?? "—"}`}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {alert.channels.map((ch) => (
                        <Badge
                          key={ch}
                          variant="outline"
                          className="border-white/10 px-1.5 py-0 text-[10px] text-zinc-400"
                        >
                          {ch}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={alert.active}
                      disabled={togglingIds.has(alert.id)}
                      onCheckedChange={(checked) => handleToggle(alert, checked)}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-500">
                    {alert.lastTriggeredAt
                      ? formatRelative(new Date(alert.lastTriggeredAt).getTime())
                      : "Nunca"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-500">
                    {alert.cooldownMinutes}m
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-400 hover:text-white"
                        title="Editar"
                        onClick={() => openEdit(alert)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-400 hover:text-white"
                        title="Historial"
                        onClick={() => openHistory(alert)}
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-400 hover:text-red-400"
                        title="Eliminar"
                        onClick={() => openDelete(alert)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Drawers & Dialogs */}
      <AlertEditDrawer
        alert={editAlert}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <AlertHistoryDrawer
        alert={historyAlert}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      <DeleteAlertDialog
        alert={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

function ConditionBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; className: string }> = {
    price_above: { label: "Supere precio", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
    price_below: { label: "Baje de precio", className: "border-red-500/30 bg-red-500/10 text-red-400" },
    change_percent: { label: "Cambio %", className: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
    rsi_extreme: { label: "RSI extremo", className: "border-purple-500/30 bg-purple-500/10 text-purple-400" },
    ma_cross: { label: "MA Cross", className: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
    volume_spike: { label: "Vol. spike", className: "border-orange-500/30 bg-orange-500/10 text-orange-400" },
  };
  const cfg = map[type] ?? { label: type, className: "border-white/10 text-zinc-400" };
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-normal px-1.5 py-0 ${cfg.className}`}
    >
      {cfg.label}
    </Badge>
  );
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "Ahora";
  if (diff < 3_600_000) return `Hace ${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `Hace ${Math.floor(diff / 3_600_000)}h`;
  return `Hace ${Math.floor(diff / 86_400_000)}d`;
}
