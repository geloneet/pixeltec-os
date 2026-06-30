"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_CONFIG } from "@/types/crm";
import type { CRMTask } from "@/types/crm";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const STATUS_ORDER: CRMTask["status"][] = [
  "pendiente",
  "en_progreso",
  "en_revision",
  "completado",
  "pausado",
  "bloqueado",
];

interface TaskStatusDropdownProps {
  status: CRMTask["status"];
  onChange: (s: CRMTask["status"]) => void;
  disabled?: boolean;
}

export function TaskStatusDropdown({ status, onChange, disabled }: TaskStatusDropdownProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all active:scale-95",
            cfg.bg,
            cfg.text,
            "hover:brightness-110"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
          {cfg.label}
          <ChevronDown className="h-2.5 w-2.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-40 border-zinc-800 bg-zinc-900 p-1 text-xs"
      >
        {STATUS_ORDER.map((s) => {
          const c = STATUS_CONFIG[s];
          return (
            <DropdownMenuItem
              key={s}
              onClick={() => onChange(s)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors",
                s === status
                  ? cn(c.bg, c.text, "font-medium")
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              )}
            >
              <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", c.dot)} />
              {c.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
