'use client';

import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { AssistantWeeklyReportSerialized } from '@/lib/assistant/types';
import type { ArchivedTaskSerialized } from '@/lib/assistant/queries/archive';

const CATEGORY_COLORS: Record<string, string> = {
  trabajo:     '#3b82f6',
  cliente:     '#8b5cf6',
  personal:    '#22c55e',
  salud:       '#f59e0b',
  aprendizaje: '#ec4899',
};

const CATEGORY_LABELS: Record<string, string> = {
  trabajo:     'Trabajo',
  cliente:     'Cliente',
  personal:    'Personal',
  salud:       'Salud',
  aprendizaje: 'Aprendizaje',
};

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  completed:   { label: 'Completada',  color: '#22c55e' },
  cancelled:   { label: 'Cancelada',   color: '#f43f5e' },
  postponed:   { label: 'Pospuesta',   color: '#f59e0b' },
  pending:     { label: 'Pendiente',   color: '#71717a' },
  in_progress: { label: 'En progreso', color: '#3b82f6' },
};

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function dayIndex(iso: string): number {
  const d = new Date(iso).getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return (d + 6) % 7;                 // 0=Mon, ..., 6=Sun
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'short',
    timeZone: 'UTC',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });
}

interface Props {
  report: AssistantWeeklyReportSerialized;
  tasks:  ArchivedTaskSerialized[];
}

export function WeekDetailClient({ report, tasks }: Props) {
  const { weekKey, weekStart, weekEnd, totals, byCategory } = report;
  const [, weekNum] = weekKey.split('-W');

  const rate = totals.total > 0
    ? Math.round((totals.completed / totals.total) * 100)
    : 0;

  const rateColor = rate >= 75 ? 'text-emerald-400' : rate >= 50 ? 'text-amber-400' : 'text-rose-400';

  // Pie data — only categories with tasks
  const pieData = Object.entries(byCategory)
    .filter(([, t]) => t.total > 0)
    .map(([cat, t]) => ({
      name:      CATEGORY_LABELS[cat] ?? cat,
      value:     t.total,
      completed: t.completed,
      fill:      CATEGORY_COLORS[cat] ?? '#6b7280',
    }));

  // Group tasks by day of week
  const byDay: ArchivedTaskSerialized[][] = Array.from({ length: 7 }, () => []);
  for (const task of tasks) {
    const idx = dayIndex(task.startsAt);
    byDay[idx].push(task);
  }

  const startStr = new Date(weekStart).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
  const endStr = new Date(weekEnd).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900/80">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/asistente/historial"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ← Historial
            </Link>
          </div>
          <h1 className="mt-2 text-xl font-semibold text-zinc-100">
            Semana {weekNum}
          </h1>
          <p className="text-sm text-zinc-400">{startStr} — {endStr}</p>
        </div>

        {/* Inline stats */}
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-2xl font-semibold tabular-nums text-zinc-100">{totals.total}</p>
            <p className="text-xs text-zinc-500">total</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums text-emerald-400">{totals.completed}</p>
            <p className="text-xs text-zinc-500">completadas</p>
          </div>
          <div>
            <p className={`text-2xl font-semibold tabular-nums ${rateColor}`}>{rate}%</p>
            <p className="text-xs text-zinc-500">completion</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums text-amber-400">
              {totals.cancelled + totals.postponed + totals.pending}
            </p>
            <p className="text-xs text-zinc-500">drift</p>
          </div>
        </div>
      </div>

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks by day — 2/3 width */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {byDay.map((dayTasks, idx) => {
            if (dayTasks.length === 0) return null;
            const dayDate = dayTasks[0].startsAt;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur"
              >
                <div className="px-5 py-3 border-b border-zinc-800/60">
                  <h3 className="text-sm font-medium text-zinc-300">
                    {DAY_NAMES[idx]}
                    <span className="ml-2 text-xs text-zinc-500 font-normal">
                      {formatDate(dayDate)}
                    </span>
                  </h3>
                </div>
                <ul className="divide-y divide-zinc-800/50">
                  {dayTasks.map(task => {
                    const s = STATUS_STYLE[task.status] ?? { label: task.status, color: '#71717a' };
                    return (
                      <li key={task.id} className="flex items-start gap-3 px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                        <span
                          className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-200 truncate">{task.title}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {formatTime(task.startsAt)} · {task.durationMin}min ·{' '}
                            <span style={{ color: CATEGORY_COLORS[task.category] }}>
                              {CATEGORY_LABELS[task.category] ?? task.category}
                            </span>
                          </p>
                        </div>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0"
                          style={{ color: s.color, borderColor: `${s.color}40`, background: `${s.color}10` }}
                        >
                          {s.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
              <p className="text-zinc-500 text-sm">Sin tasks archivadas para esta semana.</p>
            </div>
          )}
        </div>

        {/* Chart — 1/3 width */}
        <div className="flex flex-col gap-4">
          {/* Donut by category */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">Por categoría</h3>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} opacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      itemStyle={{ color: '#d4d4d8' }}
                      formatter={(value, _name, props) => [
                        `${value} total · ${props.payload.completed} completadas`,
                        props.payload.name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="space-y-1.5 mt-2">
                  {pieData.map((entry, i) => (
                    <li key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: entry.fill }} />
                        <span className="text-zinc-400">{entry.name}</span>
                      </div>
                      <span className="tabular-nums text-zinc-300">
                        {entry.completed}/{entry.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-center text-zinc-600 text-sm py-8">Sin datos</p>
            )}
          </div>

          {/* Status breakdown */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Por estado</h3>
            <div className="space-y-2">
              {Object.entries({
                completed:  totals.completed,
                pending:    totals.pending,
                postponed:  totals.postponed,
                cancelled:  totals.cancelled,
                inProgress: totals.inProgress,
              })
                .filter(([, v]) => v > 0)
                .map(([key, val]) => {
                  const s = STATUS_STYLE[key === 'inProgress' ? 'in_progress' : key] ??
                            { label: key, color: '#71717a' };
                  const pct = totals.total > 0 ? (val / totals.total) * 100 : 0;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-400">{s.label}</span>
                        <span className="tabular-nums text-zinc-300">{val}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: s.color, opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
