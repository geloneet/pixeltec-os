import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getQuoteByToken } from '@/lib/quotes/queries';
import { computeTotals, formatMoney, lineTotalCents } from '@/lib/quotes/money';

/**
 * Vista pública de una cotización (WO-2026-00102).
 *
 * Solo lectura, sin sesión y **sin acciones del cliente**: no hay aceptar, ni
 * comentar, ni formularios. Es el documento, para que el enlace de WhatsApp o
 * del correo lleve a algo que se pueda leer en el teléfono.
 *
 * `noindex`: una cotización lleva precios de un cliente concreto y no tiene
 * nada que hacer en Google.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function humanDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function formatQty(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
}

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getQuoteByToken(token);
  if (!quote) notFound();

  const totals = computeTotals(quote.items, quote.taxEnabled);
  const validUntil = humanDate(quote.validUntil);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-lg font-semibold tracking-tight text-foreground">PixelTEC</p>
          <p className="text-xs text-muted-foreground">pixeltec.mx</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Cotización</p>
          <p className="text-lg font-semibold text-foreground">{quote.folio}</p>
          {validUntil ? <p className="mt-1 text-xs text-muted-foreground">Vigencia: {validUntil}</p> : null}
        </div>
      </header>

      <h1 className="mt-8 text-2xl font-semibold text-foreground">{quote.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Para: <span className="text-foreground">{quote.clientName}</span>
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Concepto</th>
              <th className="py-2 px-3 text-right font-medium">Cant.</th>
              <th className="py-2 px-3 text-right font-medium">P. unitario</th>
              <th className="py-2 pl-3 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, i) => (
              <tr key={i} className="border-b border-border/60">
                <td className="py-3 pr-3 text-foreground">{item.description}</td>
                <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">{formatQty(item.quantity)}</td>
                <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">
                  {formatMoney(item.unitPriceCents)}
                </td>
                <td className="py-3 pl-3 text-right tabular-nums text-foreground">{formatMoney(lineTotalCents(item))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <dl className="w-56 space-y-1.5 text-sm tabular-nums">
          <div className="flex justify-between text-muted-foreground">
            <dt>Subtotal</dt>
            <dd>{formatMoney(totals.subtotalCents)}</dd>
          </div>
          {quote.taxEnabled ? (
            <div className="flex justify-between text-muted-foreground">
              <dt>IVA 16%</dt>
              <dd>{formatMoney(totals.taxCents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-foreground/80 pt-2 text-base font-semibold text-foreground">
            <dt>Total</dt>
            <dd>{formatMoney(totals.totalCents)}</dd>
          </div>
        </dl>
      </div>

      {quote.notes ? (
        <section className="mt-10 border-t border-border pt-6">
          <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground">Notas</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{quote.notes}</p>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
        ¿Dudas sobre esta cotización? Responde el correo o escríbenos por WhatsApp.
      </footer>
    </main>
  );
}
