"use client";

/**
 * Piezas compartidas de Cotizaciones (WO-2026-00104). Se separan aquí para que
 * el listado, el formulario y el detalle usen la MISMA insignia y la misma
 * conversión de filas — nunca dos versiones que se desincronizan.
 */
import { cn } from "@/lib/utils";
import { centsToInput, parseMoneyToCents, type QuoteItem } from "@/lib/quotes/money";
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
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", BADGE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Fila del formulario: el precio se edita como texto para no pelear con el input. */
export interface DraftItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

export const emptyRow = (): DraftItem => ({ description: "", quantity: "1", unitPrice: "" });

export function toQuoteItems(rows: DraftItem[]): QuoteItem[] {
  return rows.map((r) => ({
    description: r.description,
    quantity: Number(r.quantity.replace(",", ".")) || 0,
    unitPriceCents: parseMoneyToCents(r.unitPrice) ?? 0,
  }));
}

export function fromQuote(quote: QuoteView): DraftItem[] {
  const rows = quote.items.map((i) => ({
    description: i.description,
    quantity: String(i.quantity),
    unitPrice: centsToInput(i.unitPriceCents),
  }));
  return rows.length > 0 ? rows : [emptyRow()];
}

/** Título de sección del formulario (§26). */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-5 first:border-0 first:pt-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}
