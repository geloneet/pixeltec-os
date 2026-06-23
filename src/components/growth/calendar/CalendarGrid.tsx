'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScheduledPost {
  id: string;
  caption: string;
  format: string;
  scheduledAt: string;
  status: string;
  brandSnapshot: { name: string };
}

interface Props {
  posts: ScheduledPost[];
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CalendarGrid({ posts }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const postsByDay = new Map<number, ScheduledPost[]>();
  for (const post of posts) {
    const d = new Date(post.scheduledAt);
    if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
      const day = d.getDate();
      const existing = postsByDay.get(day) ?? [];
      postsByDay.set(day, [...existing, post]);
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const cells: Array<number | null> = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-poppins text-lg font-bold text-zinc-100">
          {MONTHS[viewMonth]} {viewYear}
        </h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }}>
            Hoy
          </Button>
          <Button variant="ghost" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-zinc-800/60">
        {DAYS.map((d) => (
          <div key={d} className="bg-zinc-900/60 py-2 text-center font-roboto text-xs font-medium text-zinc-600">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const dayPosts = day ? (postsByDay.get(day) ?? []) : [];
          return (
            <div
              key={i}
              className={cn(
                'min-h-[80px] bg-zinc-900/40 p-1.5',
                !day && 'opacity-30',
                day && isToday(day) && 'bg-cyan-500/5 ring-1 ring-inset ring-cyan-500/30'
              )}
            >
              {day && (
                <>
                  <span className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full font-roboto text-xs',
                    isToday(day) ? 'bg-cyan-500 font-bold text-white' : 'text-zinc-500'
                  )}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayPosts.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        className="truncate rounded bg-cyan-500/20 px-1.5 py-0.5 font-roboto text-[10px] text-cyan-300"
                        title={p.caption}
                      >
                        {p.brandSnapshot.name}
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="font-roboto text-[10px] text-zinc-600">+{dayPosts.length - 3} más</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {posts.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <CalendarDays className="h-10 w-10 text-zinc-700" />
          <p className="font-roboto text-sm text-zinc-600">
            No hay posts programados este mes.
          </p>
        </div>
      )}
    </div>
  );
}
