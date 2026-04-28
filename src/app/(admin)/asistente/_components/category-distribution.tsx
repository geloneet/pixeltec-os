import { CATEGORIES } from '@/lib/assistant/constants';
import type { WeekStats } from '@/lib/assistant/queries/stats';
import type { AssistantTaskCategory } from '@/lib/assistant/types';

interface Props {
  byCategory: WeekStats['byCategory'];
  total: number;
}

export function CategoryDistribution({ byCategory, total }: Props) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border:     '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <h3 className="text-sm font-medium text-zinc-300">Por categoría</h3>

      <div className="flex flex-col gap-2">
        {CATEGORIES.map((cat) => {
          const count = byCategory[cat.value as AssistantTaskCategory] ?? 0;
          const pct   = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={cat.value} className="flex flex-col gap-0.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px]" style={{ color: cat.color }}>
                  {cat.label}
                </span>
                <span className="text-[11px] text-zinc-500">{count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: cat.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
