"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "cyan" | "blue" | "indigo" | "violet" | "emerald" | "amber";

const ACCENT_MAP: Record<Accent, { icon: string; glow: string }> = {
  cyan: { icon: "text-cyan-400", glow: "group-hover:shadow-cyan-500/20" },
  blue: { icon: "text-blue-400", glow: "group-hover:shadow-blue-500/20" },
  indigo: { icon: "text-indigo-400", glow: "group-hover:shadow-indigo-500/20" },
  violet: { icon: "text-violet-400", glow: "group-hover:shadow-violet-500/20" },
  emerald: { icon: "text-emerald-400", glow: "group-hover:shadow-emerald-500/20" },
  amber: { icon: "text-amber-400", glow: "group-hover:shadow-amber-500/20" },
};

interface ModuleCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: Accent;
  badge?: string;
}

export function ModuleCard({
  title,
  description,
  href,
  icon: Icon,
  accent,
  badge,
}: ModuleCardProps) {
  const { icon: iconColor, glow } = ACCENT_MAP[accent];

  return (
    <Link href={href} className="block focus:outline-none">
      <article
        className={cn(
          "group relative overflow-hidden rounded-2xl p-6 h-full",
          "bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50",
          "hover:border-zinc-700/70 hover:bg-zinc-900/60",
          "transition-all duration-300",
          "shadow-lg",
          glow,
          "before:absolute before:inset-x-0 before:top-0 before:h-px",
          "before:bg-gradient-to-r before:from-transparent before:via-zinc-600/50 before:to-transparent",
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <span
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              "bg-zinc-900/60 border border-zinc-800/60",
              "transition-transform duration-300 group-hover:scale-110",
              iconColor,
            )}
          >
            <Icon className="w-5 h-5" strokeWidth={1.75} />
          </span>
          {badge && (
            <span className="inline-flex items-center rounded-full border border-zinc-700/60 bg-zinc-800/40 px-2 py-0.5 text-[10px] font-roboto text-zinc-400">
              {badge}
            </span>
          )}
        </div>
        <h3 className="font-headline text-lg font-semibold tracking-tight text-zinc-100">
          {title}
        </h3>
        <p className="mt-1 font-roboto text-sm text-zinc-400 leading-relaxed">
          {description}
        </p>
      </article>
    </Link>
  );
}
