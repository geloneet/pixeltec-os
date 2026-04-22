"use client";

import { cn } from "@/lib/utils";

interface MetricsTileProps {
  metrics: {
    alertTriggered24h: number;
    priceErrors24h: number;
  };
  oldestPriceMs: number | null;
  activeAlertCount?: number;
}

export function MetricsTile({ metrics, oldestPriceMs, activeAlertCount = 0 }: MetricsTileProps) {
  const freshnessInfo = getPriceFreshness(oldestPriceMs);

  const cards: Array<{
    label: string;
    value: string | number;
    sub?: string;
    statusClass?: string;
  }> = [
    {
      label: "Precios",
      value: freshnessInfo.label,
      sub: "Frescura",
      statusClass: freshnessInfo.colorClass,
    },
    {
      label: "Alertas 24h",
      value: metrics.alertTriggered24h,
      sub: "Disparadas",
      statusClass: "text-zinc-200",
    },
    {
      label: "Errores 24h",
      value: metrics.priceErrors24h,
      sub: "En logs",
      statusClass: metrics.priceErrors24h > 0 ? "text-red-400" : "text-zinc-200",
    },
    {
      label: "Reglas activas",
      value: activeAlertCount,
      sub: "Alertas",
      statusClass: "text-zinc-200",
    },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="mb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          Sistema
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">Métricas</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              {card.label}
            </p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", card.statusClass)}>
              {card.value}
            </p>
            {card.sub && (
              <p className="mt-0.5 text-xs text-zinc-600">{card.sub}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getPriceFreshness(oldestMs: number | null): {
  label: string;
  colorClass: string;
} {
  if (oldestMs === null) {
    return { label: "Sin datos", colorClass: "text-zinc-500" };
  }
  const ageSec = (Date.now() - oldestMs) / 1000;
  if (ageSec < 120) {
    return { label: `${Math.round(ageSec)}s`, colorClass: "text-emerald-400" };
  }
  if (ageSec < 300) {
    return { label: `${Math.round(ageSec / 60)}m`, colorClass: "text-amber-400" };
  }
  return { label: `${Math.round(ageSec / 60)}m`, colorClass: "text-red-400" };
}
