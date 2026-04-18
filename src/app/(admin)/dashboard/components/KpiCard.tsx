"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  icon: ReactNode;
  iconColor: string;
  accentClass: string;
  label: string;
  value: string;
  subtitle: string;
  footer?: ReactNode;
}

export function KpiCard({
  icon,
  iconColor,
  accentClass,
  label,
  value,
  subtitle,
  footer,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl p-6",
        "bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50",
        "hover:border-zinc-700/70 hover:bg-zinc-900/60",
        "transition-all duration-300",
        "shadow-lg",
        accentClass,
        "before:absolute before:inset-x-0 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-zinc-600/50 before:to-transparent",
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-[11px] font-headline font-semibold uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            "bg-zinc-900/60 border border-zinc-800/60",
            "transition-transform duration-300 group-hover:scale-110",
            iconColor,
          )}
        >
          {icon}
        </span>
      </div>
      <p className={cn("font-logo text-4xl font-bold tabular-nums text-zinc-100")}>
        {value}
      </p>
      <p className="mt-1 font-roboto text-xs text-zinc-500">{subtitle}</p>
      {footer}
    </div>
  );
}

function Skeleton() {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-6",
        "bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50",
        "animate-pulse",
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="h-3 w-24 rounded bg-zinc-800/80" />
        <div className="h-9 w-9 rounded-xl bg-zinc-800/80" />
      </div>
      <div className="h-10 w-20 rounded bg-zinc-800/80" />
      <div className="mt-2 h-3 w-28 rounded bg-zinc-800/60" />
    </div>
  );
}

KpiCard.Skeleton = Skeleton;
