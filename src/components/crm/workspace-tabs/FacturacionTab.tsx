"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import type { Invoice, InvoiceItem } from "@/types/documents";
import {
  getInvoices,
  createInvoice,
  getNextInvoiceNumber,
  updateInvoice,
} from "@/lib/documents/invoices";

interface Props {
  clientId: string;
}

const STATUS_CONFIG = {
  borrador:  { label: "Borrador",  classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
  enviada:   { label: "Enviada",   classes: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
  vista:     { label: "Vista",     classes: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20" },
  pagada:    { label: "Pagada",    classes: "bg-green-500/15 text-green-300 border-green-500/20" },
  vencida:   { label: "Vencida",   classes: "bg-red-500/15 text-red-400 border-red-500/20" },
  cancelada: { label: "Cancelada", classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
} satisfies Record<Invoice["status"], { label: string; classes: string }>;

const formatMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(n);

export function FacturacionTab({ clientId }: Props) {
  const user = useUser();

  const [view, setView] = useState<"list" | "create">("list");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<Omit<InvoiceItem, "id" | "subtotal">[]>([
    { description: "", qty: 1, unitPrice: 0 },
  ]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const loadInvoices = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getInvoices(user.uid, clientId);
      setInvoices(data);
    } finally {
      setLoading(false);
    }
  }, [user, clientId]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const addItem = () =>
    setItems(prev => [...prev, { description: "", qty: 1, unitPrice: 0 }]);

  const removeItem = (i: number) =>
    setItems(prev => prev.filter((_, idx) => idx !== i));

  const updateItem = (
    i: number,
    field: keyof Omit<InvoiceItem, "id" | "subtotal">,
    value: string | number,
  ) =>
    setItems(prev =>
      prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)),
    );

  const subtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const ivaRate = 0.16;
  const ivaAmount = subtotal * ivaRate;
  const total = subtotal + ivaAmount;

  const handleSave = async () => {
    if (!user || !dueDate) return;
    setSaving(true);
    try {
      const number = await getNextInvoiceNumber(user.uid);
      const invoiceItems: InvoiceItem[] = items.map((it, i) => ({
        id: `item_${i}`,
        description: it.description,
        qty: it.qty,
        unitPrice: it.unitPrice,
        subtotal: it.qty * it.unitPrice,
      }));
      await createInvoice(user.uid, clientId, {
        number,
        status: "borrador",
        items: invoiceItems,
        subtotal,
        ivaRate,
        ivaAmount,
        total,
        currency: "MXN",
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate,
        notes: notes.trim() || undefined,
      });
      setView("list");
      setItems([{ description: "", qty: 1, unitPrice: 0 }]);
      setDueDate("");
      setNotes("");
      await loadInvoices();
    } finally {
      setSaving(false);
    }
  };

  const [statusError, setStatusError] = useState<string>("");

  const handleStatusChange = async (invoice: Invoice, status: Invoice["status"]) => {
    try {
      await updateInvoice(invoice.id, { status });
      setInvoices(prev =>
        prev.map(inv => (inv.id === invoice.id ? { ...inv, status } : inv)),
      );
      setStatusError("");
    } catch {
      setStatusError("Error al actualizar estado. Intenta de nuevo.");
    }
  };

  const resetCreate = () => {
    setItems([{ description: "", qty: 1, unitPrice: 0 }]);
    setDueDate("");
    setNotes("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (view === "create") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Nueva factura</h2>
          <button
            type="button"
            onClick={() => { resetCreate(); setView("list"); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
        </div>

        {/* Line items */}
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_80px_100px_90px_32px] gap-2 text-xs text-muted-foreground px-1">
            <span>Descripción</span>
            <span>Cantidad</span>
            <span>Precio unit.</span>
            <span>Subtotal</span>
            <span />
          </div>
          {items.map((item, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_80px_100px_90px_32px] gap-2 items-center"
            >
              <input
                type="text"
                value={item.description}
                onChange={e => updateItem(i, "description", e.target.value)}
                placeholder="Descripción del servicio"
                className="rounded-md bg-secondary border border-border text-sm text-foreground px-3 py-2 placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              />
              <input
                type="number"
                min={1}
                value={item.qty}
                onChange={e => updateItem(i, "qty", Number(e.target.value))}
                className="rounded-md bg-secondary border border-border text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              />
              <input
                type="number"
                min={0}
                step={100}
                value={item.unitPrice}
                onChange={e => updateItem(i, "unitPrice", Number(e.target.value))}
                className="rounded-md bg-secondary border border-border text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              />
              <span className="text-sm text-foreground px-1">
                {formatMXN(item.qty * item.unitPrice)}
              </span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={items.length === 1}
                className="p-1 rounded text-muted-foreground hover:text-red-400 disabled:opacity-30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors mt-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar línea
          </button>
        </div>

        {/* Totals */}
        <div className="rounded-lg bg-secondary/50 border border-border p-4 space-y-1.5 w-64 ml-auto">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatMXN(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>IVA (16%)</span>
            <span>{formatMXN(ivaAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-foreground pt-1 border-t border-border mt-1">
            <span>Total</span>
            <span>{formatMXN(total)}</span>
          </div>
        </div>

        {/* Other fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Fecha de vencimiento *</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full rounded-md bg-secondary border border-border text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Condiciones de pago, observaciones..."
              className="w-full rounded-md bg-secondary border border-border text-sm text-foreground px-3 py-2 placeholder-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dueDate}
          className="px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black text-sm font-medium transition-colors"
        >
          {saving ? "Guardando..." : "Guardar factura"}
        </button>
      </div>
    );
  }

  // LIST view
  return (
    <div className="space-y-4">
      {statusError && (
        <p className="text-xs text-red-400">{statusError}</p>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Facturas</h2>
        <button
          type="button"
          onClick={() => setView("create")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-300 text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nueva factura
        </button>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No hay facturas aún.</p>
          <p className="text-xs text-muted-foreground mt-1">Crea la primera factura para este cliente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(invoice => {
            const cfg = STATUS_CONFIG[invoice.status];
            return (
              <div
                key={invoice.id}
                className="flex items-center gap-4 rounded-lg bg-secondary/50 border border-border px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{invoice.number}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vence: {new Date(invoice.dueDate).toLocaleDateString("es-MX", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>

                <span
                  className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.classes}`}
                >
                  {cfg.label}
                </span>

                <span className="text-sm font-medium text-foreground whitespace-nowrap">
                  {formatMXN(invoice.total)}
                </span>

                <select
                  value={invoice.status}
                  onChange={e =>
                    handleStatusChange(invoice, e.target.value as Invoice["status"])
                  }
                  className="rounded-md bg-secondary border border-border text-xs text-foreground px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                >
                  {(Object.keys(STATUS_CONFIG) as Invoice["status"][]).map(s => (
                    <option key={s} value={s}>
                      {STATUS_CONFIG[s].label}
                    </option>
                  ))}
                </select>

                <a
                  href={`/api/documents/invoice-pdf?invoiceId=${invoice.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/70 text-foreground transition-colors"
                >
                  PDF
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
