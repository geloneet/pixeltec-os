"use client";

import { LoaderCircle } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContextCore";
import { getNextChargeDate, getMostRecentUnpaidChargeDate } from "@/lib/crm/next-charge-date";
import { formatCurrency } from "@/lib/utils";
import type { RecurringCharge } from "@/types/crm";

interface ChargeRow {
  charge: RecurringCharge;
  clientName: string;
  projectName: string;
  nextDate: Date;
  daysUntil: number;
  overdueDate: Date | null;
}

function formatDateES(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

// `daysUntil` (derived from getNextChargeDate) is by design always a future
// date, so it can never signal "Vencido" on its own — see the doc comment
// on getMostRecentUnpaidChargeDate. `overdueDate` carries that separate
// signal: the most recent period that was due and not marked as attended.
function DueBadge({ daysUntil, overdueDate }: { daysUntil: number; overdueDate: Date | null }) {
  if (overdueDate || daysUntil <= 0) {
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-red-500/10 text-red-400">
        Vencido
      </span>
    );
  }
  if (daysUntil <= 30) {
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-400">
        en {daysUntil} días
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-zinc-800 text-zinc-400">
      en {daysUntil} días
    </span>
  );
}

export function CobrosView() {
  const { clients, loading } = useCRM();

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  const now = new Date();

  // Aggregate all charges across all clients/projects
  const rows: ChargeRow[] = [];
  clients.forEach(c => {
    c.projects.forEach(p => {
      (p.charges || []).forEach(ch => {
        const nextDate = getNextChargeDate(ch.startDate, ch.frequency);
        const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const overdueDate = getMostRecentUnpaidChargeDate(ch.startDate, ch.frequency, ch.lastNotified);
        rows.push({
          charge: ch,
          clientName: c.name,
          projectName: p.name,
          nextDate,
          daysUntil,
          overdueDate,
        });
      });
    });
  });

  // Sort overdue charges first, then by daysUntil ascending (most urgent first)
  rows.sort((a, b) => {
    const aOverdue = a.overdueDate ? 0 : 1;
    const bOverdue = b.overdueDate ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return a.daysUntil - b.daysUntil;
  });

  // Summary totals (active charges only)
  const activeRows = rows.filter(r => r.charge.active);
  const totalMonthly = activeRows
    .filter(r => r.charge.frequency === "monthly")
    .reduce((sum, r) => sum + (Number(r.charge.amount) || 0), 0);
  const totalAnnual = activeRows
    .filter(r => r.charge.frequency === "annual")
    .reduce((sum, r) => sum + (Number(r.charge.amount) || 0), 0);

  return (
    <div className="px-4 py-6 sm:px-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-zinc-100 mb-6">Cobros</h1>

      {/* Summary row */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#0F0F12] border border-zinc-800 rounded-[10px] p-4">
            <p className="text-xs text-zinc-500 mb-1">Total mensual activo</p>
            <p className="text-xl font-semibold text-zinc-100">{formatCurrency(totalMonthly)}</p>
          </div>
          <div className="bg-[#0F0F12] border border-zinc-800 rounded-[10px] p-4">
            <p className="text-xs text-zinc-500 mb-1">Total anual activo</p>
            <p className="text-xl font-semibold text-zinc-100">{formatCurrency(totalAnnual)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <p className="text-zinc-500 text-sm">No hay cobros recurrentes todavía.</p>
        </div>
      ) : (
        <div className="bg-[#0F0F12] border border-zinc-800 rounded-[10px] overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Concepto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Cliente · Proyecto</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Monto</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Frecuencia</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Próximo cobro</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Activo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {rows.map(({ charge, clientName, projectName, nextDate, daysUntil, overdueDate }) => (
                  <tr key={charge.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-zinc-200 font-medium">{charge.concept}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-400">{clientName}</span>
                      <span className="text-zinc-600 mx-1">·</span>
                      <span className="text-zinc-500">{projectName}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-zinc-200 font-medium tabular-nums">
                        {formatCurrency(Number(charge.amount) || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        charge.frequency === "monthly"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-[#0EA5E9]/10 text-[#0EA5E9]"
                      }`}>
                        {charge.frequency === "monthly" ? "Mensual" : "Anual"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-400 text-xs">{formatDateES(nextDate)}</span>
                        <DueBadge daysUntil={daysUntil} overdueDate={overdueDate} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block h-2 w-2 rounded-full ${charge.active ? "bg-emerald-400" : "bg-zinc-600"}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-zinc-800/60">
            {rows.map(({ charge, clientName, projectName, nextDate, daysUntil, overdueDate }) => (
              <div key={charge.id} className="px-4 py-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium text-zinc-200 leading-snug">{charge.concept}</p>
                  <span className={`flex-shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
                    charge.frequency === "monthly"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-[#0EA5E9]/10 text-[#0EA5E9]"
                  }`}>
                    {charge.frequency === "monthly" ? "Mensual" : "Anual"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">{clientName} · {projectName}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-100 tabular-nums">
                    {formatCurrency(Number(charge.amount) || 0)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-[11px]">{formatDateES(nextDate)}</span>
                    <DueBadge daysUntil={daysUntil} overdueDate={overdueDate} />
                  </div>
                </div>
                {!charge.active && (
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wide">Inactivo</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
