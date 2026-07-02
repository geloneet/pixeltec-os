"use client";

import { useState } from "react";
import { Bot, Hand, LoaderCircle, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ModeResult, WhatsAppMode } from "@/types/whatsapp-inbox";

const OPTIONS: { mode: WhatsAppMode; label: string; icon: typeof Bot; activeClass: string }[] = [
  { mode: "BOT", label: "Bot", icon: Bot, activeClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40" },
  { mode: "HUMAN", label: "Control humano", icon: Hand, activeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  { mode: "PAUSED", label: "Pausa", icon: PauseCircle, activeClass: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
];

interface ModeToggleProps {
  phone: string;
  mode: WhatsAppMode;
}

export function ModeToggle({ phone, mode }: ModeToggleProps) {
  const [pending, setPending] = useState<WhatsAppMode | null>(null);

  async function changeMode(next: WhatsAppMode) {
    if (next === mode || pending) return;
    setPending(next);
    try {
      const res = await fetch("/api/whatsapp-inbox/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, mode: next }),
      });
      const data = (await res.json()) as ModeResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success(
        next === "HUMAN"
          ? "Tomaste el control — el bot ya no responde en esta conversación"
          : next === "BOT"
            ? "Conversación devuelta al bot"
            : "Conversación en pausa — nadie responde automáticamente"
      );
    } catch (err) {
      toast.error(`No se pudo cambiar el modo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
      {OPTIONS.map(({ mode: m, label, icon: Icon, activeClass }) => (
        <button
          key={m}
          type="button"
          disabled={pending !== null}
          onClick={() => changeMode(m)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-xs font-medium transition-colors",
            mode === m ? activeClass : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          {pending === m ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}
