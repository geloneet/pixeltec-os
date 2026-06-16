"use client";

import type { LucideIcon } from "lucide-react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarComingSoonItemProps {
  icon: LucideIcon;
  label: string;
  /** Override the tooltip text. Defaults to label + "· Próximamente". */
  tooltip?: string;
}

/**
 * A non-interactive sidebar item for routes that are not yet available.
 * Must be rendered inside a <TooltipProvider> (DesktopSidebar already provides one).
 */
export function SidebarComingSoonItem({
  icon: Icon,
  label,
  tooltip,
}: SidebarComingSoonItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="presentation"
          aria-label={`${label} — Próximamente`}
          aria-disabled="true"
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-lg",
            "text-zinc-600 opacity-60 cursor-not-allowed select-none",
            "transition-all duration-150"
          )}
        >
          <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
          {/* Soon badge */}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-900 border border-zinc-700">
            <Clock className="h-2 w-2 text-zinc-500" />
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={12}
        className="z-[60] bg-slate-900 border border-slate-700 text-slate-100 text-sm px-3 py-1.5 rounded-lg shadow-xl"
      >
        {tooltip ?? label}
        <span className="ml-1.5 text-slate-500">· Próximamente</span>
      </TooltipContent>
    </Tooltip>
  );
}
