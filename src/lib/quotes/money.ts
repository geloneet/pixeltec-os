/**
 * Aritmética de las cotizaciones (WO-2026-00101).
 *
 * Módulo puro — sin `db`, sin `next` — porque aquí es donde una cotización se
 * equivoca y le cuesta dinero a alguien. Todo se calcula en **centavos
 * enteros**: los precios se guardan como enteros y no se suman flotantes.
 * `0.1 + 0.2 !== 0.3`, y en una cotización de 40 conceptos eso se nota.
 *
 * Moneda: MXN. IVA: 16 % opcional por cotización (decisión de Miguel).
 */

/** Tasa de IVA vigente en México, en puntos porcentuales. */
export const IVA_RATE = 16;

/**
 * Cada cuánto se cobra un concepto. Se guarda DENTRO del jsonb `items`, así que
 * no hizo falta migración: un concepto sin `recurrence` es de pago único, que
 * es como se comportaban todos los guardados hasta ahora.
 *
 * Tres opciones (Miguel, 2026-08-26): única vez, mensual y anual. Trimestral
 * queda fuera a propósito — se añadirá si algún día se usa de verdad, no por si
 * acaso. `recurring_charges.frequency` ya admitía `monthly|annual`, así que
 * «anual» no necesitó ni migración ni columna nueva.
 */
export const RECURRENCES = ['unica', 'mensual', 'anual'] as const;
export type Recurrence = (typeof RECURRENCES)[number];
export const DEFAULT_RECURRENCE: Recurrence = 'unica';

/** Lo que se elige en la columna «Frecuencia». */
export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  unica: 'Única vez',
  mensual: 'Mensual',
  anual: 'Anual',
};

/** Cómo se titula el bloque de totales de cada frecuencia. */
export const RECURRENCE_TOTAL_LABEL: Record<Recurrence, string> = {
  unica: 'Pago único',
  mensual: 'Mensual',
  anual: 'Anual',
};

/** Cómo se llama el «total» de cada bloque en el resumen. */
export const RECURRENCE_GRAND_LABEL: Record<Recurrence, string> = {
  unica: 'Total inicial',
  mensual: 'Mensualidad',
  anual: 'Anualidad',
};

/** Cómo se llama el subtotal de cada bloque. */
export const RECURRENCE_SUBTOTAL_LABEL: Record<Recurrence, string> = {
  unica: 'Subtotal',
  mensual: 'Servicios',
  anual: 'Servicios',
};

/** Cómo se lee el periodo junto a un importe: «$900.00 / mes». */
export const RECURRENCE_PER_LABEL: Record<Recurrence, string> = {
  unica: '',
  mensual: '/ mes',
  anual: '/ año',
};

export function isRecurrence(value: unknown): value is Recurrence {
  return typeof value === 'string' && (RECURRENCES as readonly string[]).includes(value);
}

/** Periodicidad de un concepto; ausente o desconocida ⇒ pago único. */
export function recurrenceOf(item: { recurrence?: string }): Recurrence {
  return isRecurrence(item.recurrence) ? item.recurrence : DEFAULT_RECURRENCE;
}

export interface QuoteItem {
  description: string;
  /** Cantidad. Admite decimales (horas, metros); se redondea a 2 al calcular. */
  quantity: number;
  /** Precio unitario en CENTAVOS enteros. */
  unitPriceCents: number;
  /** Cada cuánto se paga. Ausente ⇒ «unica» (compatibilidad hacia atrás). */
  recurrence?: Recurrence;
}

export interface QuoteTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

/** Redondeo a entero «half away from zero» — el que espera un contador. */
function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Importe de una línea, en centavos. */
export function lineTotalCents(item: QuoteItem): number {
  const qty = Math.round(item.quantity * 100) / 100;
  return roundHalfUp(qty * item.unitPriceCents);
}

/**
 * Totales de la cotización. El IVA se calcula sobre el subtotal ya redondeado,
 * no línea por línea: es como lo hace una factura mexicana y evita que la suma
 * de los IVAs de cada línea difiera del IVA del total.
 */
export function computeTotals(items: readonly QuoteItem[], taxEnabled: boolean): QuoteTotals {
  const subtotalCents = items.reduce((sum, item) => sum + lineTotalCents(item), 0);
  const taxCents = taxEnabled ? roundHalfUp((subtotalCents * IVA_RATE) / 100) : 0;
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/** Formatea centavos como moneda mexicana: 123456 → «$1,234.56». */
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Lee lo que el usuario escribió en un campo de precio y lo pasa a centavos.
 * Acepta «1234.5», «1,234.50», «$1,234.50» y espacios. Devuelve `null` si no
 * es un número — un precio que no se entiende NO se convierte en cero.
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[$\s,]/g, '');
  if (!cleaned || !/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return roundHalfUp(value * 100);
}

/** Centavos → el texto que se muestra en el input («1234.50»). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface QuoteValidationIssue {
  field: string;
  message: string;
}

/**
 * Valida una cotización antes de guardarla. Devuelve la lista de problemas;
 * vacía = se puede guardar.
 */
export function validateQuote(input: {
  title: string;
  items: readonly QuoteItem[];
  validUntil?: string | null;
}): QuoteValidationIssue[] {
  const issues: QuoteValidationIssue[] = [];

  if (!input.title.trim()) {
    issues.push({ field: 'title', message: 'La cotización necesita un título.' });
  }

  const usable = input.items.filter((i) => i.description.trim());
  if (usable.length === 0) {
    issues.push({ field: 'items', message: 'Agrega al menos un concepto con descripción.' });
  }

  input.items.forEach((item, index) => {
    if (!item.description.trim()) return;
    if (!(item.quantity > 0)) {
      issues.push({ field: `items.${index}.quantity`, message: 'La cantidad debe ser mayor que cero.' });
    }
    if (item.unitPriceCents < 0) {
      issues.push({ field: `items.${index}.unitPriceCents`, message: 'El precio no puede ser negativo.' });
    }
  });

  if (input.validUntil) {
    const date = new Date(input.validUntil);
    if (Number.isNaN(date.getTime())) {
      issues.push({ field: 'validUntil', message: 'La fecha de vigencia no es válida.' });
    }
  }

  return issues;
}

/** Descarta las líneas en blanco que deja el formulario al añadir filas. */
export function usableItems(items: readonly QuoteItem[]): QuoteItem[] {
  return items.filter((i) => i.description.trim()).map((i) => ({ ...i, description: i.description.trim() }));
}

/**
 * Totales separados por periodicidad.
 *
 * NO se suma un mensual con un pago único: son unidades distintas y un total
 * mezclado sería un número falso en un documento que va a un cliente. Una
 * cotización de «$25,000 de desarrollo + $500 al mes de hospedaje» no vale
 * $25,500: vale $25,000 ahora y $500 cada mes.
 */
export interface QuoteBreakdown {
  /** Lo que se paga una sola vez. Es la base del reparto de anticipos. */
  oneTime: QuoteTotals;
  /** Un bloque por periodicidad presente, en el orden del catálogo. */
  recurring: { recurrence: Recurrence; totals: QuoteTotals }[];
}

export function itemsByRecurrence(items: readonly QuoteItem[]): Map<Recurrence, QuoteItem[]> {
  const groups = new Map<Recurrence, QuoteItem[]>();
  for (const item of items) {
    if (!item.description.trim()) continue;
    const key = recurrenceOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

export function computeBreakdown(items: readonly QuoteItem[], taxEnabled: boolean): QuoteBreakdown {
  const groups = itemsByRecurrence(items);
  return {
    oneTime: computeTotals(groups.get('unica') ?? [], taxEnabled),
    recurring: RECURRENCES.filter((r) => r !== 'unica')
      .filter((r) => (groups.get(r) ?? []).length > 0)
      .map((recurrence) => ({ recurrence, totals: computeTotals(groups.get(recurrence)!, taxEnabled) })),
  };
}

/** `true` si la cotización mezcla pago único con algo recurrente. */
export function hasRecurring(items: readonly QuoteItem[]): boolean {
  return items.some((i) => i.description.trim() && recurrenceOf(i) !== 'unica');
}
