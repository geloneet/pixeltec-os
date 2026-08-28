"use client";

import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { sendManualRecurringReminder } from "@/lib/sales/actions";
import type { BillingItem, BillingFrequency } from "@/types/documents";
import type { RecurringChargeRow } from "@/lib/sales/recurring-view";

const FREQUENCY_GROUP_ORDER: BillingFrequency[] = ["unico", "anual", "mensual", "trimestral", "semestral"];

const FREQUENCY_GROUP_LABEL: Record<BillingFrequency, string> = {
  unico: "Pago único",
  anual: "Recurrente anual",
  mensual: "Recurrente mensual",
  trimestral: "Recurrente trimestral",
  semestral: "Recurrente semestral",
};

function formatDateES(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export function FinanzasTab({ billingItems, recurring }: { billingItems: BillingItem[]; recurring: RecurringChargeRow[] }) {
  const remind = async (id: string) => {
    const res = await sendManualRecurringReminder(id);
    if (res.ok) toast.success("Recordatorio enviado.");
    else toast.error(res.error ?? "No se pudo enviar el recordatorio.");
  };

  const groups = FREQUENCY_GROUP_ORDER.map((freq) => ({
    freq,
    items: billingItems.filter((i) => i.frequency === freq),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8 p-6">
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin cobros registrados para este cliente.</p>
      ) : (
        groups.map(({ freq, items }) => (
          <section key={freq}>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{FREQUENCY_GROUP_LABEL[freq]}</h3>
            <div className="space-y-2">
              {items.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-sm">
                  <span>{i.concept}</span>
                  <span className="text-muted-foreground">{formatCurrency(i.amount)} · {i.status}</span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {recurring.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Recordatorios de cobro recurrente</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Programación de los servicios recurrentes activos — envía un recordatorio manual sin esperar al automático.
          </p>
          <div className="space-y-2">
            {recurring.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{r.concept} — {formatCurrency(Number(r.amount))} · próximo cobro {formatDateES(r.nextChargeDate)}</span>
                <button
                  type="button"
                  onClick={() => remind(r.id)}
                  className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-accent"
                >
                  Enviar recordatorio
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
