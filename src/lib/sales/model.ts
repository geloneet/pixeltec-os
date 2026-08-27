/**
 * Vocabulario de la Venta (WO-2026-00106, ADR-0057).
 *
 * Módulo puro — sin `db`, sin `next`. Aquí viven los estados, el folio y la
 * regla que decide cuándo una venta pasa a activa.
 *
 * Lo que la Venta NO es: no es una factura, no guarda pagos y no reemplaza a
 * `billing_items`. Es el puente entre «el cliente aceptó esto» y «ahora existen
 * obligaciones financieras».
 */

// ── Estados ─────────────────────────────────────────────────────────────────

export const SALE_STATUSES = ['pendiente_anticipo', 'activa', 'completada', 'cancelada'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  pendiente_anticipo: 'Pendiente de anticipo',
  activa: 'Activa',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export function isSaleStatus(value: unknown): value is SaleStatus {
  return typeof value === 'string' && (SALE_STATUSES as readonly string[]).includes(value);
}

// ── Cómo se aceptó (§1) ─────────────────────────────────────────────────────

export const ACCEPTED_VIA = ['whatsapp', 'correo', 'otro'] as const;
export type AcceptedVia = (typeof ACCEPTED_VIA)[number];

export const ACCEPTED_VIA_LABEL: Record<AcceptedVia, string> = {
  whatsapp: 'WhatsApp',
  correo: 'Correo',
  otro: 'Otro',
};

// ── Recurrentes (§9) ────────────────────────────────────────────────────────

export const RECURRING_STATUSES = ['pending_start', 'active', 'paused', 'cancelled'] as const;
export type RecurringStatus = (typeof RECURRING_STATUSES)[number];

export const RECURRING_STATUS_LABEL: Record<RecurringStatus, string> = {
  pending_start: 'Pendiente de inicio',
  active: 'Activo',
  paused: 'Pausado',
  cancelled: 'Cancelado',
};

export function isRecurringStatus(value: unknown): value is RecurringStatus {
  return typeof value === 'string' && (RECURRING_STATUSES as readonly string[]).includes(value);
}

// ── Folio ───────────────────────────────────────────────────────────────────

export const SALE_FOLIO_RE = /^VTA-(\d{4})-(\d{4,})$/;

export function buildSaleFolio(year: number, sequence: number): string {
  return `VTA-${year}-${String(sequence).padStart(4, '0')}`;
}

export function parseSaleFolio(folio: string): { year: number; sequence: number } | null {
  const match = SALE_FOLIO_RE.exec(folio.trim());
  return match ? { year: Number(match[1]), sequence: Number(match[2]) } : null;
}

/** Consecutivo por año, como el de las cotizaciones. Un folio ilegible no bloquea. */
export function nextSaleFolio(year: number, existing: readonly string[]): string {
  const highest = existing.reduce((max, raw) => {
    const parsed = parseSaleFolio(raw);
    return parsed && parsed.year === year ? Math.max(max, parsed.sequence) : max;
  }, 0);
  return buildSaleFolio(year, highest + 1);
}

// ── El gate del anticipo (§7 y §12) ─────────────────────────────────────────

/** Lo mínimo que hay que saber de un cobro para decidir el estado de la venta. */
export interface ChargeState {
  concept: string;
  /** `billing_status`: pendiente | pagado | vencido | parcial | cancelado. */
  status: string;
  /** El primero del calendario de pagos es el anticipo. */
  isDeposit: boolean;
}

/**
 * Estado que le corresponde a la venta según el estado REAL de sus cobros.
 *
 * No existe `sale.depositPaid`: sería una segunda fuente de verdad que se
 * desincroniza en cuanto alguien registre un pago desde Finanzas. El estado se
 * deriva de los cobros, que es donde vive la deuda.
 *
 * - Anticipo cubierto ⇒ la venta se activa (el proyecto puede empezar).
 * - Todos los cobros cubiertos ⇒ completada.
 * - Una venta cancelada no se recalcula: esa decisión es humana.
 */
export function deriveSaleStatus(current: SaleStatus, charges: readonly ChargeState[]): SaleStatus {
  if (current === 'cancelada') return 'cancelada';

  const vivos = charges.filter((c) => c.status !== 'cancelado');
  if (vivos.length === 0) return current;

  const cubierto = (c: ChargeState) => c.status === 'pagado';

  if (vivos.every(cubierto)) return 'completada';

  const anticipo = vivos.find((c) => c.isDeposit) ?? vivos[0];
  return cubierto(anticipo) ? 'activa' : 'pendiente_anticipo';
}

/** ¿Puede arrancar el proyecto? Solo con la venta activa o completada (§12). */
export function readyForProject(status: SaleStatus): boolean {
  return status === 'activa' || status === 'completada';
}

// ── Aniversario de la anualidad (Miguel, 2026-08-27) ────────────────────────

/**
 * Fecha del primer cobro de un concepto ANUAL, en `YYYY-MM-DD`.
 *
 * Es el primer aniversario de la aceptación, y vale para los dos casos:
 * - anualidad cobrada al firmar ⇒ el año 1 ya está pagado, el recurrente
 *   arranca en el aniversario (si arrancara hoy se cobraría dos veces);
 * - «primer año gratis» ⇒ el año 1 no se cobra, el primero que se cobra es
 *   justo ese aniversario.
 *
 * Se usan los getters LOCALES a propósito: es una fecha de negocio («el 27 de
 * agosto del año que viene»), no un instante. Con `toISOString()` una
 * aceptación de las 8 de la noche en México caería al día siguiente en UTC y el
 * aniversario saldría corrido un día.
 *
 * 29 de febrero: JavaScript desborda a marzo, así que se retrocede al 28 —
 * cobrar el 1 de marzo un servicio contratado en febrero es un error visible en
 * un estado de cuenta.
 */
export function firstAnniversary(acceptedAt: Date): string {
  const year = acceptedAt.getFullYear() + 1;
  const month = acceptedAt.getMonth();
  const day = acceptedAt.getDate();
  const candidate = new Date(year, month, day);
  // Si el mes cambió, el día no existía en el año destino (29 de febrero).
  if (candidate.getMonth() !== month) candidate.setDate(0);
  const mm = String(candidate.getMonth() + 1).padStart(2, '0');
  const dd = String(candidate.getDate()).padStart(2, '0');
  return `${candidate.getFullYear()}-${mm}-${dd}`;
}
