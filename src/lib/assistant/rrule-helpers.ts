import { RRule } from 'rrule';
import type { WeekdayCode } from './schemas';
import type { AssistantTaskCategory } from './types';
import { getWeekRange, parseDateTimeToUTC } from './week-helpers';

export const WEEKDAY_LABELS: Record<WeekdayCode, string> = {
  MO: 'Lun',
  TU: 'Mar',
  WE: 'Mié',
  TH: 'Jue',
  FR: 'Vie',
  SA: 'Sáb',
  SU: 'Dom',
};

const WEEKDAY_ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

export function buildWeeklyRRule(weekdays: WeekdayCode[]): string {
  const sorted = [...weekdays].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
  );
  return `FREQ=WEEKLY;BYDAY=${sorted.join(',')}`;
}

export function parseWeekdaysFromRRule(rrule: string): WeekdayCode[] {
  const match = rrule.match(/BYDAY=([^;]+)/);
  if (!match) return [];
  const days = match[1].split(',') as WeekdayCode[];
  return WEEKDAY_ORDER.filter(d => days.includes(d));
}

export function generateTaskInstancesForWeek(
  template: {
    id: string;
    rrule: string;
    title: string;
    description: string | null;
    category: AssistantTaskCategory;
    defaultTime: string;
    durationMin: number;
  },
  weekKey: string,
): Array<{
  templateId: string;
  title: string;
  description: string | null;
  category: AssistantTaskCategory;
  startsAt: Date;
  durationMin: number;
  weekKey: string;
}> {
  const { start, end } = getWeekRange(weekKey);

  const ruleOptions = RRule.parseString(template.rrule);
  const rule = new RRule({ ...ruleOptions, dtstart: start });

  const occurrences = rule.between(start, end, true);

  return occurrences.map((d) => {
    const yyyy = d.getUTCFullYear();
    const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const startsAt = parseDateTimeToUTC(dateStr, template.defaultTime);
    return {
      templateId:  template.id,
      title:       template.title,
      description: template.description,
      category:    template.category,
      startsAt,
      durationMin: template.durationMin,
      weekKey,
    };
  });
}
