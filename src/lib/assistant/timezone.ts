/**
 * Timezone canonical module — Asistente.
 *
 * SINGLE SOURCE OF TRUTH para fechas/horas del módulo /asistente.
 * Toda hora introducida o mostrada al usuario está en `ASSISTANT_TZ`.
 * En Firestore se persiste como `Date` en UTC.
 *
 * Reglas:
 *  - NO usar `new Date(\`${date}T${time}\`)` para parsear fechas del usuario.
 *    Usar `parseDateTimeToUTC(date, time)`.
 *  - NO usar `getUTCDay/Date/Month/FullYear/Hours/Minutes` sobre fechas que
 *    representan hora MX. Usar `getDayIndexInAssistantTZ` o `formatInAssistantTZ`.
 *  - NO usar `timeZone: 'UTC'` en `Intl.DateTimeFormat`. Usar `formatInAssistantTZ`.
 */

import {
  isValid,
  startOfWeek,
  endOfWeek,
  getISOWeek,
  getISOWeekYear,
  type Locale,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';

export const ASSISTANT_TZ = 'America/Mexico_City';

/**
 * Convierte una fecha (YYYY-MM-DD) + hora (HH:mm) introducidas
 * por el usuario en zona Asistente a un `Date` UTC apto para Firestore.
 *
 * @throws Error si `date` o `time` no parsean o representan una
 *         fecha imposible (ej. "2026-13-99" o "25:99").
 */
export function parseDateTimeToUTC(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Fecha inválida: ${date}. Formato esperado YYYY-MM-DD`);
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`Hora inválida: ${time}. Formato esperado HH:mm`);
  }
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const local = new Date(year, month - 1, day, hours, minutes, 0);
  // El constructor de Date desborda silenciosamente ("2026-13-99" se convierte
  // en una fecha válida pero distinta). Validamos con roundtrip.
  if (
    !isValid(local) ||
    local.getFullYear() !== year ||
    local.getMonth() !== month - 1 ||
    local.getDate() !== day ||
    local.getHours() !== hours ||
    local.getMinutes() !== minutes
  ) {
    throw new Error(`Fecha/hora inválida: ${date} ${time}`);
  }
  return fromZonedTime(local, ASSISTANT_TZ);
}

/**
 * Formatea un `Date` UTC para mostrarlo en zona Asistente.
 * Locale por defecto: `es` (date-fns). Pasa `{ locale }` para sobrescribir.
 * Tokens de date-fns: https://date-fns.org/docs/format
 */
export function formatInAssistantTZ(
  d: Date,
  fmt: string,
  options?: { locale?: Locale },
): string {
  return formatInTimeZone(d, ASSISTANT_TZ, fmt, { locale: options?.locale ?? es });
}

/**
 * Día de la semana en zona Asistente.
 * Devuelve `0=lunes, 1=martes, ..., 6=domingo` (orden del módulo).
 */
export function getDayIndexInAssistantTZ(d: Date): number {
  // Token 'i' = ISO day (1=Mon..7=Sun) → -1 ⇒ 0=Mon..6=Sun
  return parseInt(formatInTimeZone(d, ASSISTANT_TZ, 'i'), 10) - 1;
}

/**
 * weekKey ISO en zona Asistente del `Date` dado. Formato: `yyyy-Www`.
 * Ej. `2026-W19`. Coincide con el usado en Firestore.
 */
export function getWeekKeyFromDateInAssistantTZ(d: Date): string {
  const mx = toZonedTime(d, ASSISTANT_TZ);
  const week = getISOWeek(mx);
  const year = getISOWeekYear(mx);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * weekKey ISO actual en zona Asistente. Formato: `yyyy-Www`.
 */
export function getCurrentWeekKeyInAssistantTZ(): string {
  return getWeekKeyFromDateInAssistantTZ(new Date());
}

/**
 * Retorna el inicio (lunes 00:00:00.000) y fin (domingo 23:59:59.999)
 * de la semana de `d` en zona Asistente, expresados como `Date` UTC.
 */
export function getWeekBoundsInAssistantTZ(d: Date): { start: Date; end: Date } {
  const zoned = toZonedTime(d, ASSISTANT_TZ);
  const startZoned = startOfWeek(zoned, { weekStartsOn: 1 });
  const endZoned = endOfWeek(zoned, { weekStartsOn: 1 });
  const start = fromZonedTime(
    new Date(
      startZoned.getFullYear(),
      startZoned.getMonth(),
      startZoned.getDate(),
      0, 0, 0, 0,
    ),
    ASSISTANT_TZ,
  );
  const end = fromZonedTime(
    new Date(
      endZoned.getFullYear(),
      endZoned.getMonth(),
      endZoned.getDate(),
      23, 59, 59, 999,
    ),
    ASSISTANT_TZ,
  );
  return { start, end };
}
