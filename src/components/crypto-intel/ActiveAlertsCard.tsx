// src/components/crypto-intel/ActiveAlertsCard.tsx

import type { AlertRule } from "@/lib/crypto-intel/types";

interface Props {
  alerts: (AlertRule & { id: string })[];
}

export function ActiveAlertsCard({ alerts }: Props) {
  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            Alertas Activas
          </p>
          <h2 className="mt-1 text-xl font-semibold">Reglas configuradas</h2>
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 font-mono text-xs text-white/60">
          {alerts.length}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 text-center">
          <p className="text-sm text-white/40">Sin alertas activas</p>
          <p className="mt-1 font-mono text-[10px] text-white/30">
            Configura una desde Telegram: /nuevaalerta
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <AlertRow key={a.id} rule={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertRow({ rule }: { rule: AlertRule & { id: string } }) {
  const desc = describeRule(rule);
  const typeColor =
    rule.type === "price_above"
      ? "text-[#00ffa3]"
      : rule.type === "price_below"
      ? "text-[#ff4560]"
      : "text-amber-400";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 font-mono text-[10px] font-semibold">
        {rule.symbol}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white/80">{desc}</div>
        <div className="mt-0.5 font-mono text-[10px] text-white/30">
          Cooldown {rule.cooldownMinutes}m · {rule.channels.join(", ")}
        </div>
      </div>
      <div className={`font-mono text-[10px] uppercase ${typeColor}`}>
        {rule.type.replace("_", " ")}
      </div>
    </div>
  );
}

function describeRule(r: AlertRule): string {
  switch (r.type) {
    case "price_above":
      return `${r.symbol} supere $${r.params.threshold?.toLocaleString()}`;
    case "price_below":
      return `${r.symbol} baje de $${r.params.threshold?.toLocaleString()}`;
    case "change_percent":
      return `${r.symbol} varíe ${r.params.threshold}% en ${r.params.window ?? "24h"}`;
    default:
      return `${r.symbol} · ${r.type}`;
  }
}
