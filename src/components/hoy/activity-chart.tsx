"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ActivityPoint } from "@/lib/hoy/types";

const PERIODS = [
  { key: "daily", label: "Diario" },
  { key: "weekly", label: "Semanal" },
  { key: "monthly", label: "Mensual" },
] as const;

type Period = (typeof PERIODS)[number]["key"];

const chartConfig = {
  count: {
    label: "Sesiones de trabajo",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

/**
 * Gráfica de actividad de /hoy — primer consumidor real de `recharts` +
 * `ui/chart.tsx` (instalados desde antes, sin consumidores). Serie: sesiones
 * de trabajo (`WorkSession.startedAt`) agrupadas por día/semana/mes —
 * `deriveActivitySeries` en `lib/hoy/crm-data.ts`. Toggle segmentado con el
 * mismo idiom visual que el pill activo del sidebar/topnav (bg-foreground).
 */
export function ActivityChart({
  activity,
}: {
  activity: { daily: ActivityPoint[]; weekly: ActivityPoint[]; monthly: ActivityPoint[] };
}) {
  const [period, setPeriod] = useState<Period>("monthly");
  const data = activity[period];

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Actividad</h3>
        <div className="flex items-center gap-1 rounded-full bg-secondary/60 p-1">
          {PERIODS.map((p) => {
            const active = p.key === period;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <ChartContainer config={chartConfig} className="mt-4 aspect-auto h-[220px] w-full">
        <BarChart data={data}>
          <CartesianGrid vertical={false} strokeOpacity={0.3} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
          />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
