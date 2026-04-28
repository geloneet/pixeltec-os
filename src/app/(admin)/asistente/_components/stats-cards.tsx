import { STATUSES } from '@/lib/assistant/constants';
import type { WeekStats } from '@/lib/assistant/queries/stats';
import type { AssistantTaskStatus } from '@/lib/assistant/types';

interface Props {
  stats: WeekStats;
}

export function StatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {STATUSES.map((s) => {
        const count = stats.byStatus[s.value as AssistantTaskStatus] ?? 0;
        const Icon  = s.icon;
        return (
          <div
            key={s.value}
            className="rounded-lg p-3 flex flex-col gap-1"
            style={{
              background: `${s.color}14`,
              border:     `1px solid ${s.color}30`,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-zinc-100">{count}</span>
              <Icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{ color: s.color }}
            >
              {s.label}
            </span>
            <span className="text-[10px] text-zinc-500">
              {stats.total > 0 ? Math.round((count / stats.total) * 100) : 0}% del total
            </span>
          </div>
        );
      })}
    </div>
  );
}
