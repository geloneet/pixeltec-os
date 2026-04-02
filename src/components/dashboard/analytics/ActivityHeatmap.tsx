'use client';

import React from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-calendar-heatmap/dist/styles.css';

interface ActivityData {
  date: string;
  total: number;
  details: string;
}

interface ActivityHeatmapProps {
  data: ActivityData[];
}

const ActivityHeatmap = ({ data }: ActivityHeatmapProps) => {
  const today = new Date();
  const sixMonthsAgo = subMonths(today, 5);
  sixMonthsAgo.setDate(1);

  return (
    <div className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl">
      <h2 className="text-base font-medium text-zinc-400 mb-4">Heatmap de Actividad (Últimos 6 Meses)</h2>
      <div className="text-zinc-300">
        <CalendarHeatmap
          startDate={sixMonthsAgo}
          endDate={today}
          values={data}
          classForValue={(value) => {
            if (!value || value.total === 0) {
              return 'color-empty';
            }
            if (value.total <= 2) {
              return 'color-scale-1';
            }
            if (value.total <= 5) {
              return 'color-scale-2';
            }
            if (value.total <= 10) {
              return 'color-scale-3';
            }
            return 'color-scale-4';
          }}
          tooltipDataAttrs={(value) => {
            const v = value as ActivityData | undefined;
            if (!v?.date) {
              return {
                'data-tooltip-id': 'heatmap-tooltip',
                'data-tooltip-content': 'Sin actividad',
              } as unknown as Record<string, string>;
            }
            const dateText = format(new Date(v.date), "d 'de' MMMM, yyyy", { locale: es });
            return {
              'data-tooltip-id': 'heatmap-tooltip',
              'data-tooltip-content': `${dateText} — ${v.total} actividades (${v.details})`,
            } as unknown as Record<string, string>;
          }}
          showWeekdayLabels={true}
        />
        <ReactTooltip id="heatmap-tooltip" />
      </div>
    </div>
  );
};

export default ActivityHeatmap;
