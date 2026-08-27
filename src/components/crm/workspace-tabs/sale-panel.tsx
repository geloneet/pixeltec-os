"use client";

/**
 * Aceptación de la cotización y lo que ocurre después (WO-2026-00106).
 *
 * Dos piezas:
 *  - `AcceptDialog` (§1): la aceptación se registra explícitamente, con cómo y
 *    cuándo. No se acepta por abrir un enlace ni por descargar el PDF.
 *  - `SalePanel` (§10): el resumen inmediato tras aceptar — nada de pantallas
 *    vacías. Venta, cobros, recurrentes y un CTA claro.
 *
 * El registro del pago NO se reimplementa: se abre el `RecordPaymentDialog`
 * que ya usa Finanzas, que a su vez llama a `recordPayment()`. ADR-0057 lo
 * exige y además esa lógica ya resuelve parciales, sobrepagos y bloqueos.
 */
import { useCallback, useEffect, useState, useTransition } from "react";
import { CheckCircle2, Receipt, Repeat, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { acceptQuote } from "@/lib/quotes/actions";
import { activateRecurring, getSaleForQuoteAction } from "@/lib/sales/actions";
import {
  ACCEPTED_VIA,
  ACCEPTED_VIA_LABEL,
  RECURRING_STATUS_LABEL,
  SALE_STATUS_LABEL,
  readyForProject,
  type AcceptedVia,
  type RecurringStatus,
  type SaleStatus,
} from "@/lib/sales/model";

/** Hoy en `YYYY-MM-DD`, que es lo que espera el input date. */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function money(amount: string, currency: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  return `${new Intl.NumberFormat("es-MX", { style: "currency", currency: currency as "MXN" }).format(value)} ${currency}`;
}

// ── §1 · Diálogo de aceptación ──────────────────────────────────────────────

export function AcceptDialog({
  quoteId,
  open,
  onOpenChange,
  onAccepted,
}: {
  quoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted: () => void;
}) {
  const [via, setVia] = useState<AcceptedVia>("whatsapp");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await acceptQuote({ id: quoteId, acceptedVia: via, acceptedAt: date, note });
      if (res.ok && res.data) {
        toast.success(
          res.data.alreadyExisted
            ? `Esta cotización ya tenía la venta ${res.data.folio}.`
            : `Venta ${res.data.folio} creada.`,
        );
        onOpenChange(false);
        onAccepted();
      } else {
        toast.error(res.error ?? "No se pudo aceptar.");
      }
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como aceptada</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground/80">Aceptada por</p>
            <div className="flex gap-2">
              {ACCEPTED_VIA.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVia(v)}
                  className={cn(
                    "h-9 flex-1 rounded-md border text-sm transition-colors",
                    via === v ? "border-foreground/40 bg-accent text-foreground" : "border-input text-muted-foreground hover:bg-accent/40",
                  )}
                >
                  {ACCEPTED_VIA_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground/80">Fecha de aceptación</p>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha de aceptación" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground/80">Nota (opcional)</p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="min-h-0 resize-none"
              aria-label="Nota de aceptación"
              placeholder="Cliente confirmó la propuesta por WhatsApp."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Al aceptar se crea la venta con sus cobros. La cotización queda congelada como evidencia de lo que aceptó
            el cliente.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? "Aceptando…" : "Aceptar y crear venta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── §10 · Lo que se ve después de aceptar ───────────────────────────────────

interface SaleView {
  id: string;
  folio: string;
  status: SaleStatus;
  currency: string;
  charges: { id: string; concept: string; amount: string; currency: string; status: string; isDeposit: boolean }[];
  recurring: { id: string; concept: string; amount: string; frequency: string; status: RecurringStatus; startDate: string | null }[];
}

const CHARGE_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  parcial: "Parcial",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

export function SalePanel({ quotationId, onOpenCharges }: { quotationId: string; onOpenCharges: () => void }) {
  const [sale, setSale] = useState<SaleView | null | "loading">("loading");
  const [activating, setActivating] = useState<string | null>(null);
  const [firstCharge, setFirstCharge] = useState(today());
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    const res = await getSaleForQuoteAction(quotationId);
    setSale(res.ok && res.data ? ((res.data.sale as SaleView) ?? null) : null);
  }, [quotationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (sale === "loading") {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  if (!sale) return null;

  const activar = (id: string) =>
    start(async () => {
      const res = await activateRecurring({ recurringId: id, firstChargeDate: firstCharge });
      if (res.ok) {
        toast.success("Servicio activado.");
        setActivating(null);
        void load();
      } else {
        toast.error(res.error ?? "No se pudo activar.");
      }
    });

  const deposit = sale.charges.find((c) => c.isDeposit);
  const listo = readyForProject(sale.status);

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium text-foreground">Venta {sale.folio}</span>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            listo ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500",
          )}
        >
          {SALE_STATUS_LABEL[sale.status]}
        </span>
      </div>

      {sale.charges.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Inversión inicial</p>
          <ul className="space-y-1.5 text-sm">
            {sale.charges.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-foreground">{c.concept}</span>
                <span className="flex shrink-0 items-center gap-3 tabular-nums">
                  <span className="text-foreground">{money(c.amount, c.currency)}</span>
                  <span
                    className={cn(
                      "w-20 text-right text-xs",
                      c.status === "pagado" ? "text-emerald-500" : "text-muted-foreground",
                    )}
                  >
                    {CHARGE_LABEL[c.status] ?? c.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sale.recurring.length > 0 ? (
        <div className="space-y-2 border-t border-border/70 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recurrente</p>
          {sale.recurring.map((r) => (
            <div key={r.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-foreground">{r.concept}</span>
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {money(r.amount, sale.currency)} <span className="text-xs text-muted-foreground">/ mes</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-5">
                <span className="text-xs text-muted-foreground">{RECURRING_STATUS_LABEL[r.status]}</span>
                {r.status === "pending_start" ? (
                  activating === r.id ? (
                    <span className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={firstCharge}
                        onChange={(e) => setFirstCharge(e.target.value)}
                        aria-label="Fecha del primer cobro"
                        className="h-8 w-40"
                      />
                      <Button type="button" size="sm" onClick={() => activar(r.id)} disabled={pending}>
                        Activar
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setActivating(null)}>
                        Cancelar
                      </Button>
                    </span>
                  ) : (
                    <Button type="button" variant="outline" size="sm" onClick={() => setActivating(r.id)}>
                      Activar recurrente
                    </Button>
                  )
                ) : r.startDate ? (
                  <span className="text-xs text-muted-foreground">· primer cobro {r.startDate}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
        {!listo && deposit ? (
          <Button type="button" size="sm" onClick={onOpenCharges}>
            <Receipt className="mr-1.5 h-3.5 w-3.5" />
            Registrar anticipo
          </Button>
        ) : null}
        {listo ? (
          <span className="flex items-center gap-1.5 text-sm text-emerald-500">
            <ArrowRight className="h-3.5 w-3.5" />
            Listo para iniciar proyecto
          </span>
        ) : null}
        <a
          href="/cobros"
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Ver en Cobros
        </a>
      </div>
    </div>
  );
}
