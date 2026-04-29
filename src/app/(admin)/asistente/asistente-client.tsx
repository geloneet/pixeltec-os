'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatInTimeZone } from '@/lib/assistant/week-helpers';
import { getWeekDays } from '@/lib/assistant/week-helpers';
import { computeWeekStats } from '@/lib/assistant/queries/stats';
import { CATEGORIES, TIMEZONE } from '@/lib/assistant/constants';
import type { AssistantTaskSerialized, AssistantWeeklyReportSerialized } from '@/lib/assistant/types';
import { WeekGrid } from './_components/week-grid';
import { StatsCards } from './_components/stats-cards';
import { TodayCard } from './_components/today-card';
import { CategoryDistribution } from './_components/category-distribution';
import { LastWeekReportCard } from './_components/last-week-report-card';
import { TaskFormDialog } from './_components/task-form-dialog';

interface Props {
  initialTasks: AssistantTaskSerialized[];
  weekKey: string;
  lastReport: AssistantWeeklyReportSerialized | null;
}

function formatWeekHeader(
  weekKey: string,
  days: ReturnType<typeof getWeekDays>,
): string {
  const [, weekNum] = weekKey.split('-W');
  const from = formatInTimeZone(days[0].date, TIMEZONE, 'd MMM');
  const to   = formatInTimeZone(days[6].date, TIMEZONE, 'd MMM');
  return `Semana ${weekNum} · ${from} - ${to}`;
}

export function AsistenteClient({ initialTasks, weekKey, lastReport }: Props) {
  const [tasks, setTasks]             = useState<AssistantTaskSerialized[]>(initialTasks);
  const [isFormOpen, setIsFormOpen]   = useState(false);
  const [editingTask, setEditingTask] = useState<AssistantTaskSerialized | undefined>();

  const days       = useMemo(() => getWeekDays(weekKey), [weekKey]);
  const stats      = useMemo(() => computeWeekStats(tasks), [tasks]);
  const weekHeader = useMemo(() => formatWeekHeader(weekKey, days), [weekKey, days]);

  function handleNewTask() {
    setEditingTask(undefined);
    setIsFormOpen(true);
  }

  function handleTaskClick(task: AssistantTaskSerialized) {
    setEditingTask(task);
    setIsFormOpen(true);
  }

  function handleSave(task: AssistantTaskSerialized) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx === -1) return [...prev, task];
      const next = [...prev];
      next[idx] = task;
      return next;
    });
  }

  function handleDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function handleStatusChange(taskId: string, status: AssistantTaskSerialized['status']) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t)),
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Asistente</h1>
          <p className="text-sm text-zinc-400">{weekHeader}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/asistente/templates">Templates</Link>
          </Button>
          <Button size="sm" onClick={handleNewTask}>
            + Nueva actividad
          </Button>
        </div>
      </div>

      {/* Week Grid */}
      <WeekGrid
        tasks={tasks}
        weekKey={weekKey}
        onTaskClick={handleTaskClick}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />

      {/* Category legend */}
      <div className="flex flex-wrap gap-3">
        {CATEGORIES.map((cat) => (
          <div key={cat.value} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: cat.color }}
            />
            <span className="text-xs text-zinc-400">{cat.label}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
          Estadísticas de la semana
        </h2>
        <StatsCards stats={stats} />
      </div>

      {/* Bottom grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
        <TodayCard tasks={stats.todayTasks} />
        <CategoryDistribution byCategory={stats.byCategory} total={stats.total} />
        <LastWeekReportCard lastReport={lastReport} />
      </div>

      <TaskFormDialog
        open={isFormOpen}
        task={editingTask}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
