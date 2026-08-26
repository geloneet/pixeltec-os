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

export interface QuoteItem {
  description: string;
  /** Cantidad. Admite decimales (horas, metros); se redondea a 2 al calcular. */
  quantity: number;
  /** Precio unitario en CENTAVOS enteros. */
  unitPriceCents: number;
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
