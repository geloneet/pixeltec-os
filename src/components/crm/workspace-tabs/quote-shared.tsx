"use client";

/**
 * Piezas compartidas de Cotizaciones (WO-2026-00104). Se separan aquí para que
 * el listado, el formulario y el detalle usen la MISMA insignia y la misma
 * conversión de filas — nunca dos versiones que se desincronizan.
 */
import { cn } from "@/lib/utils";
import {
  applyFrequencyKey,
  centsToInput,
  frequencyKeyOf,
  parseMoneyToCents,
  type FrequencyKey,
  type QuoteItem,
} from "@/lib/quotes/money";
import { STATUS_LABEL, type QuoteStatus, type PaymentTerms, type Rejection, type Currency } from "@/lib/quotes/terms";

export interface QuoteView {
  id: string;
  folio: string;
  title: string;
  items: QuoteItem[];
  taxEnabled: boolean;
  notes: string;
  validUntil: string | null;
  status: string;
  publicToken: string;
  sentAt: string | null;
  createdAt: string;
  currency: Currency;
  problem: string;
  solution: string;
  scopeIncluded: string;
  exclusions: string;
  estimatedDelivery: string;
  paymentTerms: PaymentTerms;
  acceptedAt: string | null;
  rejectedAt: string | null;
  nextFollowUpAt: string | null;
  rejection: Rejection | null;
}

const BADGE: Record<QuoteStatus, string> = {
  borrador: "bg-muted text-muted-foreground",
  enviada: "bg-sky-500/10 text-sky-500",
  aceptada: "bg-emerald-500/10 text-emerald-500",
  rechazada: "bg-rose-500/10 text-rose-500",
  vencida: "bg-amber-500/10 text-amber-500",
};

/** Insignia discreta de estado (§14). */
export function StatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", BADGE[status], className)}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Fila del formulario: el precio se edita como texto para no pelear con el input. */
export interface DraftItem {
  description: string;
  quantity: string;
  unitPrice: string;
  /** La opción elegida en «Frecuencia»: cuatro, porque «primer año gratis» es
   *  una de ellas aunque por dentro sea un anual con bandera. */
  frequency: FrequencyKey;
}

export const emptyRow = (): DraftItem => ({
  description: "",
  quantity: "1",
  unitPrice: "",
  frequency: "unica",
});

export function toQuoteItems(rows: DraftItem[]): QuoteItem[] {
  return rows.map((r) =>
    // La opción del desplegable se traduce aquí a los dos campos que se
    // guardan (`recurrence` + `firstYearFree`), en un solo sitio.
    applyFrequencyKey(
      {
        description: r.description,
        quantity: Number(r.quantity.replace(",", ".")) || 0,
        unitPriceCents: parseMoneyToCents(r.unitPrice) ?? 0,
      },
      r.frequency,
    ),
  );
}

export function fromQuote(quote: QuoteView): DraftItem[] {
  const rows = quote.items.map((i) => ({
    description: i.description,
    quantity: String(i.quantity),
    unitPrice: centsToInput(i.unitPriceCents),
    // Las cotizaciones guardadas antes de esta orden no traen el campo.
    frequency: frequencyKeyOf(i),
  }));
  return rows.length > 0 ? rows : [emptyRow()];
}

/**
 * Sección del editor (§26). La jerarquía la dan el espacio y la tipografía, no
 * una caja: un divisor fino arriba y un título legible — nada de mayúsculas
 * microscópicas en gris (§10).
 */
export function FormSection({
  title,
  aside,
  children,
}: {
  title: string;
  /** Contenido alineado a la derecha del título (p. ej. un botón discreto). */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/70 pt-7 first:border-0 first:pt-0">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Campo con etiqueta. La etiqueta pesa más que el texto auxiliar (§10). */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium text-foreground/80">{label}</p>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
