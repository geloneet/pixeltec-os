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

  // Jan 4 is always in ISO week 1
  const jan4      = new Date(Date.UTC(year, 0, 4));
  const jan4Mx    = toZonedTime(jan4, ASSISTANT_TZ);
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
