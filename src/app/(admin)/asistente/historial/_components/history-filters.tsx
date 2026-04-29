'use client';

import type { HistoryFiltersState } from '@/lib/assistant/types-history';

interface Props {
  value:    HistoryFiltersState;
  onChange: (next: HistoryFiltersState) => void;
}

export function HistoryFilters({ value, onChange }: Props) {
  const inputClass =
    'bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 ' +
    'placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors w-full';

  const selectClass =
    'bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 ' +
    'focus:outline-none focus:border-zinc-500 transition-colors w-full appearance-none cursor-pointer';

  function patch(patch: Partial<HistoryFiltersState>) {
    onChange({ ...value, ...patch });
  }

  const hasFilters = value.from || value.to || (value.status && value.status !== 'all');

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[130px]">
          <label className="block text-xs text-zinc-500 mb-1">Desde</label>
          <input
            type="date"
            className={inputClass}
            value={value.from ?? ''}
            onChange={e => patch({ from: e.target.value || undefined })}
          />
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className="block text-xs text-zinc-500 mb-1">Hasta</label>
          <input
            type="date"
            className={inputClass}
            value={value.to ?? ''}
            onChange={e => patch({ to: e.target.value || undefined })}
          />
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className="block text-xs text-zinc-500 mb-1">Estado</label>
          <select
            className={selectClass}
            value={value.status ?? 'all'}
            onChange={e => patch({ status: e.target.value as HistoryFiltersState['status'] })}
          >
            <option value="all">Todas las semanas</option>
            <option value="completed">Alta completion (≥75%)</option>
            <option value="incomplete">Baja completion (&lt;75%)</option>
          </select>
        </div>
        {hasFilters && (
          <button
            onClick={() => onChange({ status: 'all' })}
            className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded-lg transition-colors whitespace-nowrap"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
