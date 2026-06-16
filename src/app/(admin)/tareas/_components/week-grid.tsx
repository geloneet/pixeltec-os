'use client';

import { useMemo } from 'react';
import { getWeekDays, formatInTimeZone } from '@/lib/assistant/week-helpers';
import { TIMEZONE } from '@/lib/assistant/constants';
import type { AssistantTaskSerialized } from '@/lib/assistant/types';
import { TaskCard } from './task-card';

interface Props {
  tasks: AssistantTaskSerialized[];
  weekKey: string;
  onTaskClick: (task: AssistantTaskSerialized) => void;
  onStatusChange: (taskId: string, status: AssistantTaskSerialized['status']) => void;
  onDelete: (taskId: string) => void;
}

export function WeekGrid({ tasks, weekKey, onTaskClick, onStatusChange, onDelete }: Props) {
  const days = useMemo(() => getWeekDays(weekKey), [weekKey]);

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const dayStr   = formatInTimeZone(day.date, TIMEZONE, 'yyyy-MM-dd');
        const dayTasks = tasks.filter(
          (t) => formatInTimeZone(new Date(t.startsAt), TIMEZONE, 'yyyy-MM-dd') === dayStr,
        );

        return (
          <div
            key={day.dayLabel}
            className="flex flex-col gap-1.5 rounded-lg p-2"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: day.isToday
                ? '1px solid rgba(59,130,246,0.5)'
                : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11px] font-medium text-zinc-400">{day.dayLabel}</span>
              <span
                className="text-sm font-semibold"
                style={{ color: day.isToday ? '#3b82f6' : '#a1a1aa' }}
              >
                {day.dayNumber}
              </span>
            </div>

            {dayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                onEdit={onTaskClick}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
