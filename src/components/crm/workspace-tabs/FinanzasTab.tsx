"use client";

import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { sendManualRecurringReminder } from "@/lib/sales/actions";
import type { BillingItem } from "@/types/documents";
import type { RecurringChargeRow } from "@/lib/sales/recurring-view";

function formatDateES(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export function FinanzasTab({ billingItems, recurring }: { billingItems: BillingItem[]; recurring: RecurringChargeRow[] }) {
  const unico = billingItems.filter((i) => i.frequency === "unico");
  const anual = recurring.filter((r) => r.frequency === "annual");
  const mensual = recurring.filter((r) => r.frequency === "monthly");

  const remind = async (id: string) => {
    const res = await sendManualRecurringReminder(id);
    if (res.ok) toast.success("Recordatorio enviado.");
    else toast.error(res.error ?? "No se pudo enviar el recordatorio.");
  };

  return (
    <div className="space-y-8 p-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Pago único</h3>
        {unico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cobros de pago único.</p>
        ) : (
          <div className="space-y-2">
            {unico.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span>{i.concept}</span>
                <span className="text-muted-foreground">{formatCurrency(i.amount)} · {i.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {[
        { title: "Recurrente anual", rows: anual },
        { title: "Recurrente mensual", rows: mensual },
      ].map(({ title, rows }) => (
        <section key={title}>
          <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin conceptos {title === "Recurrente anual" ? "anuales" : "mensuales"}.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
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
          )}
        </section>
      ))}
    </div>
  );
}
