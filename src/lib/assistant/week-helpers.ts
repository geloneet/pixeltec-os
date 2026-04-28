import {
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
  endOfISOWeek,
  addDays,
  isToday,
} from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { TIMEZONE, DAYS_OF_WEEK } from './constants';

export function getCurrentWeekKey(): string {
  return getWeekKeyFromDate(new Date());
}

export function getWeekKeyFromDate(date: Date): string {
  const mx   = toZonedTime(date, TIMEZONE);
  const week = getISOWeek(mx);
  const year = getISOWeekYear(mx);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getWeekRange(weekKey: string): { start: Date; end: Date } {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // Jan 4 is always in ISO week 1
  const jan4      = new Date(Date.UTC(year, 0, 4));
  const jan4Mx    = toZonedTime(jan4, TIMEZONE);
  const week1Mon  = startOfISOWeek(jan4Mx);
  const targetMon = addDays(week1Mon, (week - 1) * 7);
  const targetSun = endOfISOWeek(targetMon);

  const start = fromZonedTime(
    new Date(targetMon.getFullYear(), targetMon.getMonth(), targetMon.getDate(), 0, 0, 0),
    TIMEZONE,
  );
  const end = fromZonedTime(
    new Date(targetSun.getFullYear(), targetSun.getMonth(), targetSun.getDate(), 23, 59, 59),
    TIMEZONE,
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
    const dateMX = toZonedTime(date, TIMEZONE);
    return {
      date,
      dayLabel,
      dayNumber: dateMX.getDate(),
      isToday:   isToday(dateMX),
    };
  });
}

export function parseDateTimeToUTC(date: string, time: string): Date {
  const [year, month, day]   = date.split('-').map(Number);
  const [hours, minutes]     = time.split(':').map(Number);
  return fromZonedTime(
    new Date(year, month - 1, day, hours, minutes, 0),
    TIMEZONE,
  );
}

export function formatTimeMX(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, 'HH:mm');
}

export function formatDateMX(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
}

export function isCurrentWeek(weekKey: string): boolean {
  return weekKey === getCurrentWeekKey();
}

export { formatInTimeZone };
