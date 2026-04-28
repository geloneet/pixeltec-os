'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { CATEGORIES, STATUSES } from '@/lib/assistant/constants';
import type { AssistantTaskSerialized } from '@/lib/assistant/types';

interface Props {
  tasks: AssistantTaskSerialized[];
}

function RelativeTime({ startsAt }: { startsAt: string }) {
  const [label, setLabel] = useState('Cargando…');

  useEffect(() => {
    function update() {
      setLabel(
        formatDistanceToNow(new Date(startsAt), { addSuffix: true, locale: es }),
      );
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [startsAt]);

  return <span className="text-[10px] text-zinc-500">{label}</span>;
}

export function TodayCard({ tasks }: Props) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border:     '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <h3 className="text-sm font-medium text-zinc-300">Hoy</h3>

      {tasks.length === 0 ? (
        <p className="text-xs text-zinc-500">Sin actividades para hoy</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => {
            const category = CATEGORIES.find((c) => c.value === task.category);
            const status   = STATUSES.find((s) => s.value === task.status);
            const Icon     = status?.icon;
            return (
              <li key={task.id} className="flex items-start gap-2">
                {Icon && (
                  <Icon
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    style={{ color: status?.color ?? '#71717a' }}
                  />
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-zinc-200 truncate">{task.title}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px]"
                      style={{ color: category?.color ?? '#71717a' }}
                    >
                      {category?.label}
                    </span>
                    <span className="text-zinc-700">·</span>
                    <RelativeTime startsAt={task.startsAt} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
