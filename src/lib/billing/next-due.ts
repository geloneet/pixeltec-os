import { addMonths, addYears, format, isValid, parse } from "date-fns";

export type BillingFrequency = "unico" | "mensual" | "trimestral" | "semestral" | "anual";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTHS_PER_PERIOD: Record<Exclude<BillingFrequency, "unico">, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/**
 * Parsea fechas "YYYY-MM-DD" como fecha LOCAL, evitando el off-by-one de
 * `new Date(str)` (que las interpreta como medianoche UTC). Mismo patrón que
 * `parseStartDate` en src/lib/crm/next-charge-date.ts.
 */
function parseDateOnly(dateStr: string): Date {
  if (DATE_ONLY_RE.test(dateStr)) {
    const parsed = parse(dateStr, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) return parsed;
  }
  return new Date(dateStr);
}

function formatDateOnly(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Próxima fecha de cobro dado el período actual y su frecuencia. `unico` no
 * tiene próximo cobro (`null`). El resto avanza un período usando
 * `addMonths`/`addYears` de date-fns, que recortan correctamente al último
 * día del mes destino (31 ene + 1 mes -> 28/29 feb) en vez de desbordar.
 */
export function computeNextDueDate(
  currentDueDate: string,
  frequency: BillingFrequency,
): string | null {
  if (frequency === "unico") return null;
  const current = parseDateOnly(currentDueDate);
  const next =
    frequency === "anual" ? addYears(current, 1) : addMonths(current, MONTHS_PER_PERIOD[frequency]);
  return formatDateOnly(next);
}

/**
 * "Vencido" es un estado derivado, no persistido: un cobro está vencido si
 * su `dueDate` ya pasó y sigue sin marcarse como pagado/cancelado. El día
 * mismo del vencimiento aún no cuenta como vencido.
 */
export function isOverdue(dueDate: string, today: Date = new Date()): boolean {
  // Compara solo el día calendario (no la hora) — zero-padded "yyyy-MM-dd"
  // ordena igual lexicográfica y cronológicamente.
  return formatDateOnly(parseDateOnly(dueDate)) < formatDateOnly(today);
}
