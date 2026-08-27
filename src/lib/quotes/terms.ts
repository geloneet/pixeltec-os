/**
 * Estados, vigencia, seguimiento, moneda y forma de pago (WO-2026-00104).
 *
 * Módulo puro — sin `db`, sin `next`. Es la **fuente única** que pide el §30:
 * el formulario, la vista de detalle, el PDF y el correo leen de aquí. Ninguna
 * pantalla vuelve a calcular un reparto de pago por su cuenta.
 */
import { computeBreakdown, computeTotals, type QuoteBreakdown, type QuoteItem, type QuoteTotals } from './money';

// ── Moneda (§4) ──────────────────────────────────────────────────────────────

export const CURRENCIES = ['MXN', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'MXN';

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

/** Sin conversión de divisas (§4): la moneda solo acompaña a los importes. */
export function formatAmount(cents: number, currency: Currency): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** «$34,800.00 MXN» — la forma en que se lee en un mensaje o un PDF. */
export function formatAmountWithCode(cents: number, currency: Currency): string {
  return `${formatAmount(cents, currency)} ${currency}`;
}

// ── Estados (§14) ────────────────────────────────────────────────────────────

export const QUOTE_STATUSES = ['borrador', 'enviada', 'aceptada', 'rechazada', 'vencida'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const STATUS_LABEL: Record<QuoteStatus, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  vencida: 'Vencida',
};

/**
 * Estado que se muestra. «Vencida» NO se guarda: se deriva de la vigencia, y
 * solo mientras la cotización siga esperando respuesta. Una cotización
 * aceptada no se vuelve vencida por que pase la fecha.
 */
export function displayStatus(stored: string, validUntil: string | null, now: Date): QuoteStatus {
  const status = (QUOTE_STATUSES as readonly string[]).includes(stored) ? (stored as QuoteStatus) : 'borrador';
  if (status !== 'enviada' || !validUntil) return status;
  const limit = new Date(validUntil);
  if (Number.isNaN(limit.getTime())) return status;
  return limit.getTime() < now.getTime() ? 'vencida' : status;
}

// ── Vigencia y seguimiento (§6, §20) ─────────────────────────────────────────

export const DEFAULT_VALIDITY_DAYS = 15;
export const FIRST_FOLLOW_UP_DAYS = 3;
export const NEXT_FOLLOW_UP_DAYS = 7;

function addDays(from: Date, days: number): Date {
  const out = new Date(from);
  out.setDate(out.getDate() + days);
  return out;
}

/** Vigencia por defecto de una cotización nueva: hoy + 15 días (§6). */
export function defaultValidUntil(now: Date): Date {
  return addDays(now, DEFAULT_VALIDITY_DAYS);
}

/** Primer seguimiento al enviar: +3 días (§20). */
export function firstFollowUp(sentAt: Date): Date {
  return addDays(sentAt, FIRST_FOLLOW_UP_DAYS);
}

/** Siguiente seguimiento tras atender el anterior: +7 días (§20). */
export function nextFollowUp(from: Date): Date {
  return addDays(from, NEXT_FOLLOW_UP_DAYS);
}

/** Fecha legible: «10 de septiembre de 2026». */
export function formatDate(value: string | Date | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** Fecha corta para el listado: «10 sep». */
export function formatShortDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(date);
}

/** Qué mostrar en la columna «Seguimiento» del listado (§20 y §24). */
export function followUpLabel(nextFollowUpAt: string | null, status: QuoteStatus, now: Date): string | null {
  if (!nextFollowUpAt || status !== 'enviada') return null;
  const date = new Date(nextFollowUpAt);
  if (Number.isNaN(date.getTime())) return null;

  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((day(date) - day(now)) / 86_400_000);

  if (diffDays < 0) return 'Seguimiento pendiente';
  if (diffDays === 0) return 'Hoy';
  return formatShortDate(nextFollowUpAt);
}

/** `true` cuando toca dar seguimiento (hoy o antes). */
export function needsFollowUp(nextFollowUpAt: string | null, status: QuoteStatus, now: Date): boolean {
  const label = followUpLabel(nextFollowUpAt, status, now);
  return label === 'Hoy' || label === 'Seguimiento pendiente';
}

// ── Forma de pago (§12) ──────────────────────────────────────────────────────

export const PAYMENT_TYPES = ['50_50', '40_30_30', 'mensual', 'personalizada'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];
export const DEFAULT_PAYMENT_TYPE: PaymentType = '50_50';

export interface PaymentTerms {
  type: PaymentType;
  /** Solo se usa con `personalizada`. */
  custom: string;
}

export const DEFAULT_PAYMENT_TERMS: PaymentTerms = { type: DEFAULT_PAYMENT_TYPE, custom: '' };

export const PAYMENT_LABEL: Record<PaymentType, string> = {
  '50_50': '50 / 50',
  '40_30_30': '40 / 30 / 30',
  mensual: 'Mensual',
  personalizada: 'Personalizada',
};

/** Porcentajes de cada parcialidad, en puntos porcentuales. */
const SPLITS: Record<PaymentType, { label: string; percent: number }[]> = {
  '50_50': [
    { label: 'Anticipo', percent: 50 },
    { label: 'Contra entrega', percent: 50 },
  ],
  '40_30_30': [
    { label: 'Anticipo', percent: 40 },
    { label: 'Avance', percent: 30 },
    { label: 'Entrega', percent: 30 },
  ],
  mensual: [],
  personalizada: [],
};

export interface PaymentInstalment {
  label: string;
  percent: number;
  amountCents: number;
}

/**
 * Reparte el total entre las parcialidades. **El último importe es el residuo**,
 * no un porcentaje redondeado: así la suma de las partes es exactamente el
 * total. Con 40/30/30 sobre $34,800.01 los redondeos no cuadrarían de otro modo.
 */
export function paymentSchedule(totalCents: number, terms: PaymentTerms): PaymentInstalment[] {
  const splits = SPLITS[terms.type];
  if (splits.length === 0) return [];

  let assigned = 0;
  return splits.map((split, index) => {
    const isLast = index === splits.length - 1;
    const amountCents = isLast ? totalCents - assigned : Math.round((totalCents * split.percent) / 100);
    assigned += amountCents;
    return { label: split.label, percent: split.percent, amountCents };
  });
}

/** Texto de la forma de pago para el PDF y el detalle. */
export function paymentSummary(totalCents: number, terms: PaymentTerms, currency: Currency): string {
  if (terms.type === 'personalizada') return terms.custom.trim();
  if (terms.type === 'mensual') return 'Pago mensual por servicio recurrente.';
  return paymentSchedule(totalCents, terms)
    .map((i) => `${i.label} ${i.percent}% — ${formatAmountWithCode(i.amountCents, currency)}`)
    .join('\n');
}

/** El cobro que se propone al aceptar (§22): la primera parcialidad. */
export function firstInstalment(totalCents: number, terms: PaymentTerms): PaymentInstalment | null {
  const schedule = paymentSchedule(totalCents, terms);
  if (schedule.length > 0) return schedule[0];
  // Mensual o personalizada: no hay reparto conocido ⇒ se propone el total.
  return { label: 'Pago', percent: 100, amountCents: totalCents };
}

export function parsePaymentTerms(raw: unknown): PaymentTerms {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PAYMENT_TERMS };
  const value = raw as Record<string, unknown>;
  const type = typeof value.type === 'string' && (PAYMENT_TYPES as readonly string[]).includes(value.type)
    ? (value.type as PaymentType)
    : DEFAULT_PAYMENT_TYPE;
  return { type, custom: typeof value.custom === 'string' ? value.custom : '' };
}

// ── Exclusiones por defecto (§10) ────────────────────────────────────────────

export const DEFAULT_EXCLUSIONS = [
  'Cambios posteriores al alcance aprobado se cotizan por separado.',
  'Servicios o licencias de terceros no están incluidos salvo que se indique expresamente.',
  'Todo elemento no listado dentro del alcance se considera fuera de esta propuesta.',
].join('\n');

// ── Motivo de rechazo (§23) ──────────────────────────────────────────────────

export const REJECTION_REASONS = [
  'precio',
  'no_respondio',
  'otra_opcion',
  'proyecto_detenido',
  'no_era_buen_cliente',
  'otro',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const REJECTION_LABEL: Record<RejectionReason, string> = {
  precio: 'Precio',
  no_respondio: 'No respondió',
  otra_opcion: 'Eligió otra opción',
  proyecto_detenido: 'Proyecto detenido',
  no_era_buen_cliente: 'No era buen cliente',
  otro: 'Otro',
};

export interface Rejection {
  reason: RejectionReason;
  comment: string;
}

// ── Validación por intención (§29) ───────────────────────────────────────────

export interface QuoteForValidation {
  title: string;
  items: readonly QuoteItem[];
  validUntil: string | null;
  problem: string;
  solution: string;
  scopeIncluded: string;
  paymentTerms: PaymentTerms;
}

/**
 * Qué falta para poder marcar la cotización como enviada (§29). Guardar un
 * borrador solo exige título y un concepto — eso lo cubre `validateQuote`.
 * Aquí se comprueba lo que un cliente no debería recibir en blanco.
 */
export function missingToSend(quote: QuoteForValidation): string[] {
  const missing: string[] = [];
  const usable = quote.items.filter((i) => i.description.trim());

  if (!quote.title.trim()) missing.push('el título');
  if (usable.length === 0) missing.push('al menos un concepto');
  if (computeTotals(usable, false).subtotalCents <= 0) missing.push('un total mayor que cero');
  if (!quote.validUntil) missing.push('la vigencia');
  if (!quote.problem.trim()) missing.push('el problema a resolver');
  if (!quote.solution.trim()) missing.push('la solución propuesta');
  if (!quote.scopeIncluded.trim()) missing.push('el alcance incluido');
  if (quote.paymentTerms.type === 'personalizada' && !quote.paymentTerms.custom.trim()) {
    missing.push('las condiciones de pago');
  }
  return missing;
}

/** Totales de la cotización — reexportado para que nadie importe dos módulos. */
export function totalsFor(items: readonly QuoteItem[], taxEnabled: boolean): QuoteTotals {
  return computeTotals(items.filter((i) => i.description.trim()), taxEnabled);
}

/**
 * Desglose por periodicidad. Es lo que deben usar las pantallas: el reparto de
 * anticipos, el cobro y el «Total» del listado se apoyan en `oneTime`, porque
 * un anticipo del 50 % de una mensualidad no significa nada.
 */
export function breakdownFor(items: readonly QuoteItem[], taxEnabled: boolean): QuoteBreakdown {
  return computeBreakdown(items, taxEnabled);
}
