"use client";

import { useState } from "react";
import { Hand, Send, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useIsRestrictedRole } from "@/hooks/use-restricted-role";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { addContactNote } from "@/lib/whatsapp-inbox/contacts-client";
import type { SendResult, WhatsAppMode } from "@/types/whatsapp-inbox";
import { postModeChange } from "./AutomationStateMenu";
import { resolveMode } from "./ui/meta";

interface ComposerProps {
  phone: string;
  mode: WhatsAppMode;
  windowOpen: boolean;
  onSent?: () => void;
  /** Notifica a ChatThread (dueño de useInboxContactNotes) que refetchee tras guardar una nota. */
  onNoteSaved?: () => void;
  /** Refresca conversaciones tras un takeover desde el propio composer. */
  onModeChanged?: () => void;
}

type ComposerMode = "message" | "note";

export function Composer({ phone, mode, windowOpen, onSent, onNoteSaved, onModeChanged }: ComposerProps) {
  const [composerMode, setComposerMode] = useState<ComposerMode>("message");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [takingControl, setTakingControl] = useState(false);
  const isRestricted = useIsRestrictedRole();

  // Presentación: la nota interna es CRM y el middleware la deniega a un rol
  // restringido. Mostrar el selector sería enseñarle al revisor de Meta un
  // botón que falla. Fail-closed mientras la sesión carga (`undefined`).
  const canWriteNotes = isRestricted === false;

  const canWriteMessage = mode === "HUMAN";
  const isNoteMode = canWriteNotes && composerMode === "note";

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
          "Meta rechazó el envío (¿requiere plantilla aprobada?). El mensaje quedó registrado en el bot."
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
    setSending(true);
    try {
      await addContactNote(phone, trimmed);
      setText("");
      onNoteSaved?.();
    } catch (err) {
      toast.error(`Error guardando la nota: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  async function takeControl() {
    if (takingControl) return;
    setTakingControl(true);
    try {
      await postModeChange(phone, "HUMAN");
      toast.success("Tomaste el control — ya puedes responder");
      onModeChanged?.();
    } catch (err) {
      toast.error(`No se pudo tomar el control: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTakingControl(false);
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
    <div className="border-t border-border p-3">
      {/* Selector horizontal Responder | Nota interna (§8.6) */}
      {canWriteNotes && (
        <div className="mb-2 flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-1 sm:w-fit">
          <button
            type="button"
            aria-pressed={!isNoteMode}
            onClick={() => switchMode("message")}
            className={cn(
              "flex-1 rounded-md px-3 py-1 text-xs font-medium transition-colors sm:flex-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
              !isNoteMode
                ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Responder
          </button>
          <button
            type="button"
            aria-pressed={isNoteMode}
            onClick={() => switchMode("note")}
            className={cn(
              "flex-1 rounded-md px-3 py-1 text-xs font-medium transition-colors sm:flex-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
              isNoteMode
                ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Nota interna
          </button>
        </div>
      )}

      {/* Bot/pausa a cargo: en vez de un campo gris bloqueado, explica y ofrece el takeover. */}
      {!isNoteMode && !canWriteMessage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-3">
          <p className="text-sm text-muted-foreground">
            {resolveMode(mode) === "PAUSED"
              ? "El bot está pausado en esta conversación."
              : "El bot está atendiendo esta conversación."}
          </p>
          <button
            type="button"
            onClick={() => void takeControl()}
            disabled={takingControl}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {takingControl ? <Spinner size="sm" /> : <Hand aria-hidden className="h-4 w-4" />}
            Tomar control y responder
          </button>
        </div>
      ) : (
        <>
          {!windowOpen && !isNoteMode && (
            <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
              WhatsApp requiere una plantilla aprobada para escribir fuera de la ventana de 24 h — el
              envío libre probablemente falle.
            </p>
          )}
          <div className="flex items-end gap-2">
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
              aria-label={isNoteMode ? "Nota interna" : "Respuesta al cliente"}
              placeholder={isNoteMode ? "Nota interna (no se envía por WhatsApp)…" : "Escribe tu respuesta…"}
              className={cn(
                "min-h-[44px] flex-1 resize-none rounded-lg border bg-secondary/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                isNoteMode
                  ? "border-violet-500/40 focus:border-violet-500/60"
                  : "border-border focus:border-cyan-500/50"
              )}
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={disabled || !text.trim()}
              className={cn(
                "inline-flex h-[44px] items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                "focus-visible:outline-none focus-visible:ring-2",
                isNoteMode
                  ? "bg-violet-600 hover:bg-violet-500 focus-visible:ring-violet-400/40"
                  : "bg-cyan-600 hover:bg-cyan-500 focus-visible:ring-cyan-400/40"
              )}
            >
              {isNoteMode ? <StickyNote aria-hidden className="h-4 w-4" /> : <Send aria-hidden className="h-4 w-4" />}
              {isNoteMode ? "Guardar nota" : "Enviar"}
            </button>
          </div>
          <p className="mt-1 text-right text-[11px] text-muted-foreground/60">
            Enter envía · Shift+Enter salto de línea
          </p>
        </>
      )}
    </div>
  );
}
