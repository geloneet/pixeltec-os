import { HardDrive, MemoryStick, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VpsServerStats } from "@/lib/vps-types";

function diskBarGradient(percent: number): string {
  if (percent >= 85) return "from-red-500 to-rose-400";
  if (percent >= 70) return "from-amber-500 to-orange-400";
  return "from-emerald-500 to-teal-400";
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  children,
}: {
  icon: typeof HardDrive;
  label: string;
  value: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-5 backdrop-blur-xl transition-all duration-300",
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-zinc-600/50 before:to-transparent",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/[0.03] after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100",
        "hover:border-zinc-700/70 hover:bg-zinc-900/60"
      )}
    >
      <div className="relative flex items-center justify-between">
        <span className="font-roboto text-xs uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <Icon className="h-4 w-4 text-zinc-600" strokeWidth={1.75} />
      </div>
      <div className="relative mt-3 flex items-baseline gap-2">
        <span className="font-league-spartan text-3xl font-bold tabular-nums text-zinc-50">
          {value}
        </span>
        {detail && (
          <span className="font-roboto text-xs text-zinc-500">{detail}</span>
        )}
      </div>
      {children && <div className="relative mt-4">{children}</div>}
    </div>
  );
}

export function ServerStatsHeader({ server }: { server: VpsServerStats }) {
  const pct = server.diskPercent;
  const critical = pct >= 85;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard
        icon={HardDrive}
        label="Disco"
        value={`${pct}%`}
        detail={`${server.diskUsed} / ${server.diskTotal}`}
      >
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/70">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-all duration-500",
              diskBarGradient(pct),
              critical && "animate-pulse"
            )}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between font-roboto text-xs text-zinc-500">
          <span>Usado</span>
          <span>Libre · {server.diskFree}</span>
        </div>
      </StatCard>

      <StatCard
        icon={MemoryStick}
        label="Memoria"
        value={server.memUsed}
        detail={`/ ${server.memTotal}`}
      >
        <div className="flex items-center justify-between font-roboto text-xs text-zinc-500">
          <span>En uso</span>
          <span>Libre · {server.memFree}</span>
        </div>
      </StatCard>

      <StatCard
        icon={Clock}
        label="Uptime"
        value={server.uptime.replace(/^up\s+/i, "")}
      />
    </div>
  );
}
