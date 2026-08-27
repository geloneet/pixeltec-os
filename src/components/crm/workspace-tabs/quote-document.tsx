/**
 * El documento de la cotización, tal como lo ve el cliente.
 *
 * Se comparte entre la **vista previa en pop-up** del panel y la página pública
 * `/c/[token]`: una sola implementación, así no pueden divergir. Es
 * presentacional puro — sin estado, sin `db`, sin acciones — para poder usarse
 * desde un Server Component y desde un Client Component por igual.
 *
 * No calcula: pide el desglose a `@/lib/quotes/money` y `terms` (fuente única).
 */
import {
  FREQUENCY_KEY_LABEL,
  frequencyKeyOf,
  isFirstYearFree,
  RECURRENCE_TOTAL_LABEL,
  RECURRENCE_GRAND_LABEL,
  RECURRENCE_SUBTOTAL_LABEL,
  lineTotalCents,
  recurrenceOf,
  type QuoteItem,
  type Recurrence,
} from "@/lib/quotes/money";
import {
  breakdownFor,
  formatAmount,
  formatDate,
  annualRenewalSummary,
  paymentSummary,
  type Currency,
  type PaymentTerms,
} from "@/lib/quotes/terms";

export interface QuoteDocumentData {
  folio: string;
  title: string;
  items: QuoteItem[];
  taxEnabled: boolean;
  currency: Currency;
  notes: string;
  validUntil: string | null;
  createdAt: string;
  problem: string;
  solution: string;
  scopeIncluded: string;
  exclusions: string;
  estimatedDelivery: string;
  paymentTerms: PaymentTerms;
}

function formatQty(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
}

function Block({ title, body }: { title: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{body}</p>
    </section>
  );
}

/** Bloque de totales de una periodicidad. */
function TotalsBlock({
  heading,
  subtotalLabel,
  grandLabel,
  totals,
  currency,
  taxEnabled,
  emphasis,
}: {
  heading: string;
  subtotalLabel: string;
  grandLabel: string;
  totals: { subtotalCents: number; taxCents: number; totalCents: number };
  currency: Currency;
  taxEnabled: boolean;
  emphasis: boolean;
}) {
  return (
    <dl className="w-60 space-y-1.5 text-sm tabular-nums">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{heading}</p>
      <div className="flex justify-between text-muted-foreground">
        <dt>{subtotalLabel}</dt>
        <dd>{formatAmount(totals.subtotalCents, currency)}</dd>
      </div>
      {taxEnabled ? (
        <div className="flex justify-between text-muted-foreground">
          <dt>IVA 16%</dt>
          <dd>{formatAmount(totals.taxCents, currency)}</dd>
        </div>
      ) : null}
      <div
        className={
          emphasis
            ? "flex items-baseline justify-between border-t border-foreground/70 pt-2 text-base font-semibold text-foreground"
            : "flex items-baseline justify-between border-t border-border pt-2 text-sm font-medium text-foreground"
        }
      >
        <dt>{grandLabel}</dt>
        <dd>
          {formatAmount(totals.totalCents, currency)} <span className="text-xs font-normal">{currency}</span>
        </dd>
      </div>
    </dl>
  );
}

export function QuoteDocument({ quote, clientName }: { quote: QuoteDocumentData; clientName: string }) {
  const breakdown = breakdownFor(quote.items, quote.taxEnabled);
  const validUntil = formatDate(quote.validUntil);

  return (
    <article className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-lg font-semibold tracking-tight text-foreground">PixelTEC</p>
          <p className="text-xs text-muted-foreground">pixeltec.mx</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Propuesta</p>
          <p className="text-lg font-semibold text-foreground">{quote.folio}</p>
          <p className="mt-1 text-xs text-muted-foreground">Fecha: {formatDate(quote.createdAt)}</p>
          {validUntil ? <p className="text-xs text-muted-foreground">Vigencia: {validUntil}</p> : null}
        </div>
      </header>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{quote.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Para: <span className="text-foreground">{clientName}</span>
        </p>
      </div>

      <Block title="El problema" body={quote.problem} />
      <Block title="Solución propuesta" body={quote.solution} />
      <Block title="Alcance incluido" body={quote.scopeIncluded} />

      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Inversión</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Concepto</th>
                <th className="py-2 px-3 font-medium">Frecuencia</th>
                <th className="py-2 px-3 text-right font-medium">Cant.</th>
                <th className="py-2 px-3 text-right font-medium">Precio</th>
                <th className="py-2 pl-3 text-right font-medium">Importe</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, i) => {
                const gratis = isFirstYearFree(item);
                return (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-2.5 pr-3 text-foreground">{item.description}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">
                      {FREQUENCY_KEY_LABEL[frequencyKeyOf(item)]}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                      {formatQty(item.quantity)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                      {formatAmount(item.unitPriceCents, quote.currency)}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-foreground">
                      {gratis ? (
                        // El precio se muestra igual —es lo que costará al
                        // renovar— pero tachado y con el importe real de hoy.
                        <span className="text-muted-foreground">
                          <span className="line-through">{formatAmount(lineTotalCents(item), quote.currency)}</span>{" "}
                          <span className="text-xs">incluido</span>
                        </span>
                      ) : (
                        formatAmount(lineTotalCents(item), quote.currency)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap justify-end gap-x-10 gap-y-5 pt-2">
          <TotalsBlock
            heading={breakdown.annualRenewal ? "Al firmar" : RECURRENCE_TOTAL_LABEL.unica}
            subtotalLabel={RECURRENCE_SUBTOTAL_LABEL.unica}
            grandLabel={RECURRENCE_GRAND_LABEL.unica}
            totals={breakdown.oneTime}
            currency={quote.currency}
            taxEnabled={quote.taxEnabled}
            emphasis
          />
          {breakdown.recurring.map(({ recurrence, totals }) => (
            <TotalsBlock
              key={recurrence}
              heading={RECURRENCE_TOTAL_LABEL[recurrence]}
              subtotalLabel={RECURRENCE_SUBTOTAL_LABEL[recurrence]}
              grandLabel={RECURRENCE_GRAND_LABEL[recurrence]}
              totals={totals}
              currency={quote.currency}
              taxEnabled={quote.taxEnabled}
              emphasis={false}
            />
          ))}
        </div>
      </section>

      <Block title="Tiempo estimado" body={quote.estimatedDelivery} />
      <Block
        title="Forma de pago"
        body={paymentSummary(breakdown.oneTime.totalCents, quote.paymentTerms, quote.currency)}
      />
      {/* La renovación va AQUÍ y no en la columna de totales (Miguel,
          2026-08-27): mismo formato que «Forma de pago» y con la frase que la
          explica. En la columna, la etiqueta larga se comía el importe. */}
      {breakdown.annualRenewal ? (
        <Block
          title="Renovación anual"
          body={annualRenewalSummary(
            breakdown.annualRenewal,
            quote.taxEnabled,
            quote.currency,
            quote.items.some(isFirstYearFree),
          )}
        />
      ) : null}
      <Block title="Fuera de alcance" body={quote.exclusions} />
      <Block title="Notas y condiciones" body={quote.notes} />

      <section className="rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Siguiente paso</h3>
        <p className="mt-1.5 text-sm text-foreground">Aceptar la propuesta y realizar el anticipo correspondiente.</p>
      </section>
    </article>
  );
}
