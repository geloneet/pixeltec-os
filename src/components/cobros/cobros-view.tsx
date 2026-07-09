"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { getBillingItems } from "@/lib/documents/billing";
import { formatCurrency } from "@/lib/utils";
import {
  BILLING_FREQUENCY_LABELS,
  BILLING_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type BillingItem,
  type BillingStatus,
  type BillingFrequency,
  type PaymentMethod,
} from "@/types/documents";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

type PillFilter = "todos" | "pendientes" | "vencidos" | "pagados" | "recurrentes" | "unicos";

const PILLS: { id: PillFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pendientes", label: "Pendientes" },
  { id: "vencidos", label: "Vencidos" },
  { id: "pagados", label: "Pagados" },
  { id: "recurrentes", label: "Recurrentes" },
  { id: "unicos", label: "Únicos" },
];

const STATUS_CLASSES: Record<BillingStatus, string> = {
  pendiente: "bg-zinc-800 text-zinc-400",
  pagado: "bg-emerald-500/10 text-emerald-400",
  vencido: "bg-red-500/10 text-red-400",
  parcial: "bg-amber-500/10 text-amber-400",
  cancelado: "bg-zinc-800 text-zinc-600",
};

function formatDateES(dateOnly: string): string {
  // dateOnly es "YYYY-MM-DD" — parsear como fecha local evita el off-by-one de zona horaria.
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export function CobrosView() {
  const [items, setItems] = useState<BillingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pill, setPill] = useState<PillFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<BillingStatus | "">("");
  const [clientFilter, setClientFilter] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState<BillingFrequency | "">("");
  const [contractFilter, setContractFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "">("");
  const [dueBeforeFilter, setDueBeforeFilter] = useState("");
  const [paymentItem, setPaymentItem] = useState<BillingItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBillingItems();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i) => { if (i.clientName) map.set(i.clientId, i.clientName); });
    return Array.from(map.entries());
  }, [items]);

  const contractOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i) => { if (i.contractId && i.contractTitle) map.set(i.contractId, i.contractTitle); });
    return Array.from(map.entries());
  }, [items]);

  const filtered = items.filter((item) => {
    if (pill === "pendientes" && item.status !== "pendiente") return false;
    if (pill === "vencidos" && item.status !== "vencido") return false;
    if (pill === "pagados" && item.status !== "pagado") return false;
    if (pill === "recurrentes" && item.frequency === "unico") return false;
    if (pill === "unicos" && item.frequency !== "unico") return false;
    if (statusFilter && item.status !== statusFilter) return false;
    if (clientFilter && item.clientId !== clientFilter) return false;
    if (frequencyFilter && item.frequency !== frequencyFilter) return false;
    if (contractFilter && item.contractId !== contractFilter) return false;
    if (dueBeforeFilter && item.dueDate > dueBeforeFilter) return false;
    if (methodFilter && !item.paymentHistory.some((p) => p.method === methodFilter)) return false;
    return true;
  });

  const activeItems = items.filter((i) => i.status !== "cancelado");
  const totalPendiente = activeItems
    .filter((i) => i.status === "pendiente" || i.status === "vencido" || i.status === "parcial")
    .reduce((sum, i) => sum + i.amount, 0);
  const totalVencido = activeItems.filter((i) => i.status === "vencido").reduce((sum, i) => sum + i.amount, 0);
  const totalPagado = items.filter((i) => i.status === "pagado").reduce((sum, i) => sum + i.amount, 0);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="lg" className="text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-100">Cobros</h1>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-4">
          <p className="mb-1 text-xs text-zinc-500">Pendiente (activo)</p>
          <p className="text-xl font-semibold text-zinc-100">{formatCurrency(totalPendiente)}</p>
        </div>
        <div className="rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-4">
          <p className="mb-1 text-xs text-zinc-500">Vencido</p>
          <p className="text-xl font-semibold text-red-400">{formatCurrency(totalVencido)}</p>
        </div>
        <div className="rounded-[10px] border border-zinc-800 bg-[#0F0F12] p-4">
          <p className="mb-1 text-xs text-zinc-500">Pagado (histórico)</p>
          <p className="text-xl font-semibold text-emerald-400">{formatCurrency(totalPagado)}</p>
        </div>
      </div>

      {/* Pills */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {PILLS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPill(p.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              pill === p.id
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                : "border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as BillingStatus | "")}
          className="rounded-lg border border-zinc-800 bg-[#0F0F12] px-3 py-1.5 text-xs text-zinc-300 focus:border-cyan-500/40 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {(Object.keys(BILLING_STATUS_LABELS) as BillingStatus[]).map((s) => (
            <option key={s} value={s}>{BILLING_STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-[#0F0F12] px-3 py-1.5 text-xs text-zinc-300 focus:border-cyan-500/40 focus:outline-none"
        >
          <option value="">Todos los clientes</option>
          {clientOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>

        <select
          value={frequencyFilter}
          onChange={(e) => setFrequencyFilter(e.target.value as BillingFrequency | "")}
          className="rounded-lg border border-zinc-800 bg-[#0F0F12] px-3 py-1.5 text-xs text-zinc-300 focus:border-cyan-500/40 focus:outline-none"
        >
          <option value="">Toda frecuencia</option>
          {(Object.keys(BILLING_FREQUENCY_LABELS) as BillingFrequency[]).map((f) => (
            <option key={f} value={f}>{BILLING_FREQUENCY_LABELS[f]}</option>
          ))}
        </select>

        <select
          value={contractFilter}
          onChange={(e) => setContractFilter(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-[#0F0F12] px-3 py-1.5 text-xs text-zinc-300 focus:border-cyan-500/40 focus:outline-none"
        >
          <option value="">Todo contrato</option>
          {contractOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>

        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | "")}
          className="rounded-lg border border-zinc-800 bg-[#0F0F12] px-3 py-1.5 text-xs text-zinc-300 focus:border-cyan-500/40 focus:outline-none"
        >
          <option value="">Todo método de pago</option>
          {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
          ))}
        </select>

        <input
          type="date"
          value={dueBeforeFilter}
          onChange={(e) => setDueBeforeFilter(e.target.value)}
          title="Vencimiento antes de"
          className="rounded-lg border border-zinc-800 bg-[#0F0F12] px-3 py-1.5 text-xs text-zinc-300 focus:border-cyan-500/40 focus:outline-none"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center text-center">
          <p className="text-sm text-zinc-500">No hay cobros con estos filtros.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-zinc-800 bg-[#0F0F12]">
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Concepto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Cliente</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">Monto</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-zinc-500">Frecuencia</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Vencimiento</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-zinc-500">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-zinc-900/40">
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-200">{item.concept}</span>
                      {item.contractTitle && <p className="text-[10px] text-zinc-600">{item.contractTitle}</p>}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{item.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-zinc-200">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-md bg-[#0EA5E9]/10 px-2 py-0.5 text-[11px] font-medium text-[#0EA5E9]">
                        {BILLING_FREQUENCY_LABELS[item.frequency]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {formatDateES(item.dueDate)}
                      {item.nextDueDate && (
                        <p className="text-[10px] text-zinc-600">Próximo: {formatDateES(item.nextDueDate)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASSES[item.status]}`}>
                        {BILLING_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.status !== "pagado" && item.status !== "cancelado" ? (
                        <button
                          onClick={() => setPaymentItem(item)}
                          className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
                        >
                          Registrar pago
                        </button>
                      ) : (
                        <span className="text-[11px] text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-zinc-800/60 sm:hidden">
            {filtered.map((item) => (
              <div key={item.id} className="space-y-2 px-4 py-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium leading-snug text-zinc-200">{item.concept}</p>
                  <span className={`flex-shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASSES[item.status]}`}>
                    {BILLING_STATUS_LABELS[item.status]}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">{item.clientName ?? "—"}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tabular-nums text-zinc-100">{formatCurrency(item.amount)}</span>
                  <span className="text-[11px] text-zinc-500">{formatDateES(item.dueDate)}</span>
                </div>
                {item.status !== "pagado" && item.status !== "cancelado" && (
                  <button
                    onClick={() => setPaymentItem(item)}
                    className="w-full rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
                  >
                    Registrar pago
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {paymentItem && (
        <RecordPaymentDialog
          item={paymentItem}
          onClose={() => setPaymentItem(null)}
          onRecorded={() => { setPaymentItem(null); load(); }}
        />
      )}
    </div>
  );
}
