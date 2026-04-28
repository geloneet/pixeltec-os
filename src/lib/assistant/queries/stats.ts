import { toZonedTime } from 'date-fns-tz';
import { formatDateMX } from '../week-helpers';
import { TIMEZONE } from '../constants';
import type { AssistantTaskSerialized, AssistantTaskStatus, AssistantTaskCategory } from '../types';

export interface WeekStats {
  total:      number;
  byStatus:   Record<AssistantTaskStatus, number>;
  byCategory: Record<AssistantTaskCategory, number>;
  todayTasks: AssistantTaskSerialized[];
}

export function computeWeekStats(tasks: AssistantTaskSerialized[]): WeekStats {
  const todayMX = formatDateMX(toZonedTime(new Date(), TIMEZONE));

  const byStatus: Record<AssistantTaskStatus, number> = {
    pending: 0, in_progress: 0, completed: 0, cancelled: 0, postponed: 0,
  };

  const byCategory: Record<AssistantTaskCategory, number> = {
    trabajo: 0, cliente: 0, personal: 0, salud: 0, aprendizaje: 0,
  };

  const todayTasks: AssistantTaskSerialized[] = [];

  for (const task of tasks) {
    byStatus[task.status]++;
    byCategory[task.category]++;
    if (formatDateMX(new Date(task.startsAt)) === todayMX) {
      todayTasks.push(task);
    }
  }

  return { total: tasks.length, byStatus, byCategory, todayTasks };
}
