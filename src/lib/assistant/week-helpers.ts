import {
  startOfISOWeek,
  endOfISOWeek,
  addDays,
  isToday,
} from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { DAYS_OF_WEEK } from './constants';
import {
  ASSISTANT_TZ,
  parseDateTimeToUTC,
  formatInAssistantTZ,
  getCurrentWeekKeyInAssistantTZ,
  getWeekKeyFromDateInAssistantTZ,
} from './timezone';

/** @deprecated Importa `ASSISTANT_TZ` desde `./timezone`. */
export const TIMEZONE = ASSISTANT_TZ;

export function getCurrentWeekKey(): string {
  return getCurrentWeekKeyInAssistantTZ();
}

export function getWeekKeyFromDate(date: Date): string {
  return getWeekKeyFromDateInAssistantTZ(date);
}

export function getWeekRange(weekKey: string): { start: Date; end: Date } {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // Jan 4 is always in ISO week 1.
  //
  // Build it directly as a Mexico-City WALL date instead of a UTC instant
  // converted afterwards: `fromZonedTime` turns "Jan 4, 00:00 in MX" into
  // the correct UTC instant, then `toZonedTime` turns that instant back
  // into a Date whose local getters read as MX wall time (the idiom used
  // throughout this file). Previously `Date.UTC(year, 0, 4)` created
  // midnight UTC Jan 4, which is 18:00 Jan 3 in MX (UTC-6) — so
  // `toZonedTime` was handed the wrong instant and its wall-clock reading
  // came out as Jan 3, silently shifting every ISO week of the year by 7
  // days whenever Jan 4 falls on a Monday (e.g. 2027).
  const jan4Instant = fromZonedTime(new Date(year, 0, 4, 0, 0, 0), ASSISTANT_TZ);
  const jan4Mx    = toZonedTime(jan4Instant, ASSISTANT_TZ);
  const week1Mon  = startOfISOWeek(jan4Mx);
  const targetMon = addDays(week1Mon, (week - 1) * 7);
  const targetSun = endOfISOWeek(targetMon);

  const start = fromZonedTime(
    new Date(targetMon.getFullYear(), targetMon.getMonth(), targetMon.getDate(), 0, 0, 0),
    ASSISTANT_TZ,
  );
  const end = fromZonedTime(
    new Date(targetSun.getFullYear(), targetSun.getMonth(), targetSun.getDate(), 23, 59, 59, 999),
    ASSISTANT_TZ,
  );

  return { start, end };
}

export function getWeekDays(weekKey: string): Array<{
  date: Date;
  dayLabel: string;
  dayNumber: number;
  isToday: boolean;
}> {
  const { start } = getWeekRange(weekKey);
  return DAYS_OF_WEEK.map((dayLabel, i) => {
    const date   = addDays(start, i);
    const dateMX = toZonedTime(date, ASSISTANT_TZ);
    return {
      date,
      dayLabel,
      dayNumber: dateMX.getDate(),
      isToday:   isToday(dateMX),
    };
  });
}

export function formatTimeMX(date: Date): string {
  return formatInAssistantTZ(date, 'HH:mm');
}

export function formatDateMX(date: Date): string {
  return formatInAssistantTZ(date, 'yyyy-MM-dd');
}

export function isCurrentWeek(weekKey: string): boolean {
  return weekKey === getCurrentWeekKey();
}

export { parseDateTimeToUTC };
export { formatInTimeZone };
