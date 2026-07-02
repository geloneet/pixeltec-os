"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import type { SendResult, WhatsAppMode } from "@/types/whatsapp-inbox";

interface ComposerProps {
  phone: string;
  mode: WhatsAppMode;
  windowOpen: boolean;
}

export function Composer({ phone, mode, windowOpen }: ComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const canWrite = mode === "HUMAN";

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending || !canWrite) return;
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp-inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, text: trimmed }),
      });
      const data = (await res.json()) as SendResult & { error?: string; detail?: string };
      if (!res.ok) {
        const detail = data.detail;
        throw new Error(data.error ?? detail ?? `HTTP ${res.status}`);
      }
      if (data.status === "persisted_but_send_failed") {
        toast.warning(
          "Meta rechazó el envío (¿ventana de 24h cerrada?). El mensaje quedó registrado en el bot."
        );
      } else {
        setText("");
      }
      // El eco del mensaje llega vía Firestore (outbox del bot) en unos segundos.
    } catch (err) {
      toast.error(`Error enviando: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-zinc-800/60 p-3">
      {!windowOpen && canWrite && (
        <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-300">
          Ventana de 24h cerrada: Meta solo acepta plantillas aprobadas. El envío libre
          probablemente falle.
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={4096}
          disabled={!canWrite || sending}
          placeholder={
            canWrite
              ? "Escribe como PIXELTEC… (Enter envía, Shift+Enter salto de línea)"
              : 'Toma el control ("Control humano") para escribir'
          }
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!canWrite || sending || !text.trim()}
          className="inline-flex h-[44px] items-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
          Enviar
        </button>
      </div>
    </div>
  );
}
