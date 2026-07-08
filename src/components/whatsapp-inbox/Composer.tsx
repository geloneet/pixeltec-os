"use client";

import { useState } from "react";
import { Send, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useFirestore, useUser } from "@/firebase";
import { cn } from "@/lib/utils";
import { addContactNote } from "@/lib/whatsapp-inbox/contacts";
import type { SendResult, WhatsAppMode } from "@/types/whatsapp-inbox";

interface ComposerProps {
  phone: string;
  mode: WhatsAppMode;
  windowOpen: boolean;
  onSent?: () => void;
}

type ComposerMode = "message" | "note";

// Composer obtiene Firestore/uid directamente (useFirestore/useUser) en vez de
// recibirlos como props del hilo: las notas son una escritura directa a
// Firestore independiente del flujo de envío por la API del bot, y así
// ChatThread no tiene que cablear props extra solo para esto.
export function Composer({ phone, mode, windowOpen, onSent }: ComposerProps) {
  const firestore = useFirestore();
  const user = useUser();
  const [composerMode, setComposerMode] = useState<ComposerMode>("message");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const canWriteMessage = mode === "HUMAN";
  const isNoteMode = composerMode === "note";

  function switchMode(next: ComposerMode) {
    if (next === composerMode) return;
    setComposerMode(next);
    setText("");
  }

  async function sendMessage(trimmed: string) {
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
      // El mensaje ya quedó persistido en pixelbot (enviado o no); refetch vía
      // polling para reflejarlo en el hilo y en la lista de conversaciones.
      onSent?.();
    } catch (err) {
      toast.error(`Error enviando: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  async function saveNote(trimmed: string) {
    if (!firestore) return;
    if (!user?.uid) {
      toast.error("No se pudo identificar tu usuario.");
      return;
    }
    setSending(true);
    try {
      await addContactNote(firestore, phone, trimmed, user.uid);
      setText("");
    } catch (err) {
      toast.error(`Error guardando la nota: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (isNoteMode) {
      void saveNote(trimmed);
      return;
    }
    if (!canWriteMessage) return;
    void sendMessage(trimmed);
  }

  const disabled = isNoteMode ? sending : !canWriteMessage || sending;

  return (
    <div className="border-t border-zinc-800/60 p-3">
      {!windowOpen && canWriteMessage && !isNoteMode && (
        <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-300">
          Ventana de 24h cerrada: Meta solo acepta plantillas aprobadas. El envío libre
          probablemente falle.
        </p>
      )}
      <div className="flex items-end gap-2">
        <div className="flex flex-shrink-0 flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
          <button
            type="button"
            onClick={() => switchMode("message")}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              !isNoteMode ? "bg-cyan-500/15 text-cyan-300" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Mensaje
          </button>
          <button
            type="button"
            onClick={() => switchMode("note")}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              isNoteMode ? "bg-violet-500/15 text-violet-300" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Nota
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={2}
          maxLength={4096}
          disabled={disabled}
          placeholder={
            isNoteMode
              ? "Nota interna (no se envía por WhatsApp)…"
              : canWriteMessage
                ? "Escribe como PIXELTEC… (Enter envía, Shift+Enter salto de línea)"
                : 'Toma el control ("Control humano") para escribir'
          }
          className={cn(
            "min-h-[44px] flex-1 resize-none rounded-lg border bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            isNoteMode
              ? "border-violet-500/40 focus:border-violet-500/60"
              : "border-zinc-800 focus:border-cyan-500/50"
          )}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={disabled || !text.trim()}
          className={cn(
            "inline-flex h-[44px] items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            isNoteMode ? "bg-violet-600 hover:bg-violet-500" : "bg-cyan-600 hover:bg-cyan-500"
          )}
        >
          {isNoteMode ? <StickyNote className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {isNoteMode ? "Guardar nota" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
