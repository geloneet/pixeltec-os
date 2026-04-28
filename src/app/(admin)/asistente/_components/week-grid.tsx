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
      {days.map((day, idx) => {
        const isSunday = idx === 6;
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

            {isSunday && dayTasks.length === 0 && (
              <div
                className="rounded-md p-2 mt-auto"
                style={{
                  border:     '1px dashed rgba(245,158,11,0.4)',
                  background: 'rgba(245,158,11,0.04)',
                }}
              >
                <p className="text-[10px] text-amber-500/70 leading-none mb-0.5">12:00 PM</p>
                <p className="text-[11px] text-amber-500/50">Reporte automático (Fase 4)</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
