"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { recordPayment } from "@/lib/documents/billing";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, type BillingItem, type PaymentMethod } from "@/types/documents";

const METHODS: PaymentMethod[] = ["efectivo", "transferencia", "tarjeta"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  item: BillingItem;
  onClose: () => void;
  onRecorded: () => void;
}

export function RecordPaymentDialog({ item, onClose, onRecorded }: Props) {
  const [amount, setAmount] = useState(item.amount);
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [paidAt, setPaidAt] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!(amount > 0)) return;
    setSaving(true);
    setError(null);
    try {
      await recordPayment(item.id, {
        amount,
        method,
        paidAt,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      onRecorded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el pago");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-white/[0.08] bg-zinc-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">Registrar pago</h3>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs text-zinc-500">
          {item.concept} · adeudo del período: <span className="text-zinc-300">{formatCurrency(item.amount)}</span>
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Monto</label>
            <input
              type="number" min={0} step="0.01" value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Método de pago</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
            >
              {METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Fecha de pago</label>
            <input
              type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Referencia (opcional)</label>
            <input
              value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="No. de transferencia, folio..."
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Nota (opcional)</label>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        {item.paymentHistory.length > 0 && (
          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Historial de pagos</p>
            <div className="max-h-32 space-y-1.5 overflow-y-auto">
              {item.paymentHistory.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{p.paidAt} · {PAYMENT_METHOD_LABELS[p.method]}</span>
                  <span className="text-zinc-300">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={saving || !(amount > 0)}
            className="flex-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-2 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Registrando..." : "Registrar pago"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/[0.06] px-4 py-2 text-sm text-zinc-500 transition-all hover:text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
