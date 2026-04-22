// src/components/crypto-intel/SystemStatusCard.tsx

interface Props {
  assetsTracked: number;
  oldestPriceTimestamp: number | null;
  activeAlertsCount: number;
}

export function SystemStatusCard({
  assetsTracked,
  oldestPriceTimestamp,
  activeAlertsCount,
}: Props) {
  const staleness = oldestPriceTimestamp
    ? Math.floor((Date.now() - oldestPriceTimestamp) / 1000)
    : null;

  const isHealthy = staleness !== null && staleness < 180; // <3min = sano

  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <div className="mb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          Estado del Sistema
        </p>
        <h2 className="mt-1 text-xl font-semibold">Telemetría</h2>
      </div>

      <div className="space-y-4">
        <StatRow
          label="Assets trackeados"
          value={assetsTracked.toString()}
          accent={isHealthy ? "#00ffa3" : "#ff4560"}
        />
        <StatRow
          label="Freshness de precios"
          value={
            staleness === null
              ? "—"
              : staleness < 60
              ? `${staleness}s`
              : `${Math.floor(staleness / 60)}m ${staleness % 60}s`
          }
          accent={isHealthy ? "#00ffa3" : "#ff4560"}
        />
        <StatRow
          label="Alertas activas"
          value={activeAlertsCount.toString()}
          accent="#ffffff"
        />
      </div>

      <div className="mt-6 border-t border-white/5 pt-4">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isHealthy ? "bg-[#00ffa3]" : "bg-[#ff4560]"
            } ${isHealthy ? "animate-pulse" : ""}`}
          />
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">
            {isHealthy ? "Operational" : "Degraded"}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/5 pb-2">
      <span className="text-xs text-white/50">{label}</span>
      <span
        className="font-mono text-lg font-medium tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </span>
    </div>
  );
}
