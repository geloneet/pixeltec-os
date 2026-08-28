import { addMonths, addYears, differenceInCalendarDays, isValid, parse } from "date-fns";

type Frequency = "monthly" | "annual";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parsea `startDate` como fecha LOCAL.
 *
 * `<input type="date">` entrega strings "YYYY-MM-DD". Pasar ese string
 * directo a `new Date(...)` lo interpreta como medianoche UTC, que en
 * America/Mexico_City (UTC-6) cae en el día ANTERIOR (18:00 del día previo)
 * — el clásico off-by-one. Para strings date-only lo parseamos con los
 * componentes de fecha directamente (sin pasar por UTC). Para strings que ya
 * traen hora/timezone (ej. el fallback `new Date().toISOString()` al crear
 * un cargo sin fecha), se respeta el parseo normal.
 */
function parseStartDate(startDate: string): Date {
  if (DATE_ONLY_RE.test(startDate)) {
    const parsed = parse(startDate, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) return parsed;
  }
  return new Date(startDate);
}

function stepForward(date: Date, frequency: Frequency): Date {
  return frequency === "monthly" ? addMonths(date, 1) : addYears(date, 1);
}

/**
 * Próxima fecha de cobro (siempre futura respecto a "ahora").
 *
 * Usa `addMonths`/`addYears` de date-fns en vez de `setMonth`/`setFullYear`
 * manual: `setMonth` desborda fin de mes (31 ene + 1 mes -> 3 mar), mientras
 * que `addMonths` recorta correctamente al último día del mes destino.
 *
 * NOTA: por diseño esta función SIEMPRE devuelve una fecha futura (o igual
 * a "ahora" nunca, estrictamente mayor). Por eso NO sirve por sí sola para
 * determinar si un cargo está "Vencido" — un cobro impago simplemente
 * rueda al siguiente período sin quedar nunca en el pasado. Para eso usa
 * `getMostRecentUnpaidChargeDate`.
 */
export function getNextChargeDate(startDate: string, frequency: Frequency): Date {
  const now = new Date();
  let next = parseStartDate(startDate);
  while (next <= now) {
    next = stepForward(next, frequency);
  }
  return next;
}

/**
 * Fecha del período MÁS RECIENTE que ya debió cobrarse (<= ahora), o `null`
 * si todavía no ocurre el primer período (startDate en el futuro) o si ese
 * período ya fue atendido.
 *
 * LIMITACIÓN DE DATOS: `RecurringCharge` no tiene un campo que indique si un
 * período fue efectivamente COBRADO/PAGADO — sólo `lastNotified`, que marca
 * si ya se envió el recordatorio para ese período. Como proxy usamos
 * `lastNotified`: si coincide con la clave (yyyy-MM-dd) del período vencido
 * más reciente, lo tratamos como atendido y no se marca "Vencido". Esto es
 * una aproximación (avisado != pagado); la solución completa requeriría un
 * campo explícito tipo `lastCollectedPeriod` con su propia migración de
 * datos, que se deja pendiente a propósito para no ampliar el alcance de
 * este fix.
 */
export function getMostRecentUnpaidChargeDate(
  startDate: string,
  frequency: Frequency,
  lastNotified?: string
): Date | null {
  const now = new Date();
  const start = parseStartDate(startDate);
  if (start > now) return null;

  let current = start;
  let mostRecent: Date | null = null;
  while (current <= now) {
    mostRecent = current;
    current = stepForward(current, frequency);
  }
  if (!mostRecent) return null;

  const periodKey = mostRecent.toISOString().split("T")[0];
  if (lastNotified === periodKey) return null;

  return mostRecent;
}

export const ANNUAL_REMINDER_CHECKPOINTS = [30, 15, 1] as const;
export const MONTHLY_REMINDER_CHECKPOINTS = [2, 1] as const;

export interface ReminderCycleState {
  reminderCycleDue: string | null;
  reminderCheckpointsSent: number[];
}

export interface ReminderPlan {
  /** Ciclo (YYYY-MM-DD) sobre el que aplican estos avisos. */
  cycleDue: string;
  /** Checkpoints (días antes) que toca mandar HOY. */
  checkpointsToSend: number[];
  /** `true` si el ciclo cambió respecto al guardado — hay que reiniciar `reminderCheckpointsSent`. */
  isNewCycle: boolean;
}

/**
 * Qué avisos de un recurrente ACTIVO tocan hoy — función pura, sin `db`.
 *
 * Anual: 30, 15 y 1 día antes. Mensual: 2 y 1 día antes (Miguel, 2026-08-27).
 * Después de que el período vence, esta función deja de mandar avisos "antes"
 * — de ahí en adelante lo materializa `recurring-scheduler.ts` como cobro
 * pendiente y el aviso pasa a ser el de `billing-charges` (ADR-0040) o el
 * recordatorio manual.
 */
export function planReminders(
  dueDate: Date,
  frequency: Frequency,
  state: ReminderCycleState,
  today: Date,
): ReminderPlan {
  const cycleDue = dueDate.toISOString().slice(0, 10);
  const isNewCycle = state.reminderCycleDue !== cycleDue;
  const alreadySent = isNewCycle ? [] : state.reminderCheckpointsSent;
  const daysUntil = differenceInCalendarDays(dueDate, today);
  const thresholds = frequency === 'annual' ? ANNUAL_REMINDER_CHECKPOINTS : MONTHLY_REMINDER_CHECKPOINTS;
  const checkpointsToSend = thresholds.filter((t) => daysUntil <= t && daysUntil > 0 && !alreadySent.includes(t));
  return { cycleDue, checkpointsToSend, isNewCycle };
}
