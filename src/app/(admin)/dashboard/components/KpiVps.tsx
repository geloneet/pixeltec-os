"use client";

import Link from "next/link";
import { HardDrive } from "lucide-react";
import { useVpsStatus } from "@/lib/vps-swr";
import { KpiCard } from "./KpiCard";
import { cn } from "@/lib/utils";

export function KpiVps() {
  const { data, error, isLoading } = useVpsStatus();

  if (isLoading && !data) {
    return <KpiCard.Skeleton />;
  }

  if (error || !data) {
    return (
      <Link href="/vps" className="block focus:outline-none">
        <KpiCard
          icon={<HardDrive className="w-5 h-5" />}
          iconColor="text-zinc-500"
          accentClass="shadow-zinc-500/10 group-hover:shadow-zinc-500/20"
          label="VPS disco"
          value="—"
          subtitle="sin datos"
        />
      </Link>
    );
  }

  const pct = data.server.diskPercent;
  const barColor =
    pct < 70 ? "bg-emerald-500" : pct < 85 ? "bg-amber-500" : "bg-red-500";
  const textColor =
    pct < 70 ? "text-emerald-400" : pct < 85 ? "text-amber-400" : "text-red-400";

  return (
    <Link href="/vps" className="block focus:outline-none">
      <KpiCard
        icon={<HardDrive className="w-5 h-5" />}
        iconColor={textColor}
        accentClass="shadow-emerald-500/10 group-hover:shadow-emerald-500/20"
        label="VPS disco"
        value={`${pct}%`}
        subtitle={`${data.server.diskUsed} / ${data.server.diskTotal}`}
        footer={
          <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", barColor)}
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
        }
      />
    </Link>
  );
}
