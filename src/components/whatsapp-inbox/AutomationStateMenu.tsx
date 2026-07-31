"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ModeResult, WhatsAppMode } from "@/types/whatsapp-inbox";
import { MODE_META, modeLabel, resolveMode } from "./ui/meta";

/**
 * Único punto del front que muta el modo de una conversación. El contrato de
 * POST /api/whatsapp-inbox/mode ({phone, mode, pausedUntil?}) no cambia.
 * Composer lo reutiliza para "Tomar control y responder".
 */
export async function postModeChange(
  phone: string,
  mode: WhatsAppMode,
  pausedUntil?: string
): Promise<ModeResult> {
  const res = await fetch("/api/whatsapp-inbox/mode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, mode, ...(pausedUntil ? { pausedUntil } : {}) }),
  });
  const data = (await res.json()) as ModeResult & { error?: string; detail?: string };
  if (!res.ok) {
    throw new Error(data.error ?? data.detail ?? `HTTP ${res.status}`);
  }
  return data;
}

const PAUSE_OPTIONS: { label: string; ms: number | null; toast: string }[] = [
  { label: "Pausar 30 min", ms: 30 * 60 * 1000, toast: "Bot en pausa 30 min" },
  { label: "Pausar 1 hora", ms: 60 * 60 * 1000, toast: "Bot en pausa 1 hora" },
  { label: "Pausar 2 horas", ms: 2 * 60 * 60 * 1000, toast: "Bot en pausa 2 horas" },
  { label: "Pausar hasta resolver", ms: null, toast: "Bot en pausa hasta que lo reactives" },
];

interface AutomationStateMenuProps {
  phone: string;
  mode: WhatsAppMode;
  pausedUntil?: string | null;
  onChanged?: () => void;
}

/**
 * Control único de automatización (§8.4): un botón que EXPRESA el estado
 * actual ("Bot respondiendo" / "Control humano" / "Bot pausado hasta 14:30")
 * y un menú con las acciones. Sustituye al ModeToggle segmentado, que se
 * renderizaba duplicado en header y ficha.
 */
export function AutomationStateMenu({ phone, mode, pausedUntil, onChanged }: AutomationStateMenuProps) {
  const [pending, setPending] = useState(false);

  const current = MODE_META[resolveMode(mode)];
  const CurrentIcon = current.icon;
  const label = modeLabel(mode, pausedUntil);

  async function changeMode(next: WhatsAppMode, pausedUntilIso?: string, successMsg?: string) {
    if (pending) return;
    setPending(true);
    try {
      await postModeChange(phone, next, pausedUntilIso);
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
      setPending(false);
    }
  }

  function handlePause(option: (typeof PAUSE_OPTIONS)[number]) {
    const pausedUntilIso = option.ms != null ? new Date(Date.now() + option.ms).toISOString() : undefined;
    void changeMode("PAUSED", pausedUntilIso, option.toast);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label={`Automatización: ${label}. Abrir acciones`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
            "disabled:cursor-not-allowed disabled:opacity-60",
            current.activeClassName
          )}
        >
          {pending ? <Spinner size="sm" /> : <CurrentIcon aria-hidden className="h-3.5 w-3.5" />}
          <span className="max-w-44 truncate">{label}</span>
          <ChevronDown aria-hidden className="h-3 w-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 border-border bg-popover/95 text-popover-foreground backdrop-blur-xl"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          ¿Quién atiende esta conversación?
        </DropdownMenuLabel>
        {mode !== "HUMAN" && (
          <DropdownMenuItem
            onClick={() => void changeMode("HUMAN")}
            className="cursor-pointer text-sm focus:bg-secondary focus:text-foreground"
          >
            Tomar control
          </DropdownMenuItem>
        )}
        {mode !== "BOT" && (
          <DropdownMenuItem
            onClick={() => void changeMode("BOT")}
            className="cursor-pointer text-sm focus:bg-secondary focus:text-foreground"
          >
            Devolver al bot
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-border" />
        {PAUSE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.label}
            onClick={() => handlePause(option)}
            className="cursor-pointer text-sm focus:bg-secondary focus:text-foreground"
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
