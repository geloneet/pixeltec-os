"use client";

import { useState } from "react";
import { Bot, ChevronDown, Hand, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ModeResult, WhatsAppMode } from "@/types/whatsapp-inbox";

const OPTIONS: { mode: WhatsAppMode; label: string; icon: typeof Bot; activeClass: string }[] = [
  { mode: "BOT", label: "Bot", icon: Bot, activeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40" },
  { mode: "HUMAN", label: "Control humano", icon: Hand, activeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" },
];

const PAUSE_ACTIVE_CLASS = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40";

const PAUSE_OPTIONS: { label: string; ms: number | null; toast: string }[] = [
  { label: "30 minutos", ms: 30 * 60 * 1000, toast: "Bot en pausa 30 min" },
  { label: "1 hora", ms: 60 * 60 * 1000, toast: "Bot en pausa 1 hora" },
  { label: "2 horas", ms: 2 * 60 * 60 * 1000, toast: "Bot en pausa 2 horas" },
  { label: "Hasta resolver", ms: null, toast: "Bot en pausa hasta que lo reactives" },
];

interface ModeToggleProps {
  phone: string;
  mode: WhatsAppMode;
  onChanged?: () => void;
}

export function ModeToggle({ phone, mode, onChanged }: ModeToggleProps) {
  const [pending, setPending] = useState<WhatsAppMode | null>(null);

  async function changeMode(next: WhatsAppMode, pausedUntil?: string, successMsg?: string) {
    if ((next === mode && next !== "PAUSED" && !pausedUntil) || pending) return;
    setPending(next);
    try {
      const res = await fetch("/api/whatsapp-inbox/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, mode: next, ...(pausedUntil ? { pausedUntil } : {}) }),
      });
      const data = (await res.json()) as ModeResult & { error?: string; detail?: string };
      if (!res.ok) {
        const detail = data.detail;
        throw new Error(data.error ?? detail ?? `HTTP ${res.status}`);
      }
      toast.success(
        successMsg ??
          (next === "HUMAN"
            ? "Tomaste el control — el bot ya no responde en esta conversación"
            : "Conversación devuelta al bot")
      );
      onChanged?.();
    } catch (err) {
      toast.error(`No se pudo cambiar el modo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPending(null);
    }
  }

  function handlePause(option: (typeof PAUSE_OPTIONS)[number]) {
    const pausedUntil = option.ms != null ? new Date(Date.now() + option.ms).toISOString() : undefined;
    void changeMode("PAUSED", pausedUntil, option.toast);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-1">
      {OPTIONS.map(({ mode: m, label, icon: Icon, activeClass }) => (
        <button
          key={m}
          type="button"
          disabled={pending !== null}
          onClick={() => void changeMode(m)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-xs font-medium transition-colors",
            mode === m ? activeClass : "text-muted-foreground hover:text-foreground"
          )}
        >
          {pending === m ? <Spinner size="sm" /> : <Icon className="h-3.5 w-3.5" />}
          {label}
        </button>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={pending !== null}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "PAUSED" ? PAUSE_ACTIVE_CLASS : "text-muted-foreground hover:text-foreground"
            )}
          >
            {pending === "PAUSED" ? (
              <Spinner size="sm" />
            ) : (
              <PauseCircle className="h-3.5 w-3.5" />
            )}
            Pausar
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="border-border bg-popover/95 text-popover-foreground backdrop-blur-xl" align="end">
          {PAUSE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.label}
              onClick={() => handlePause(option)}
              className="cursor-pointer text-xs focus:bg-secondary focus:text-foreground"
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
