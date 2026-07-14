"use client";

import { useState } from "react";
import { Send } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/** Textarea para pedir ajustes a la IA. Cmd/Ctrl+Enter envía. */
export function StationComposer({ onSend, disabled, placeholder }: Props) {
  const [text, setText] = useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        disabled={disabled}
        placeholder={placeholder ?? "Responde con los cambios que quieras al documento…"}
        className="w-full resize-none rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 disabled:opacity-50"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/70">⌘/Ctrl + Enter para enviar</span>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          Enviar ajustes
        </button>
      </div>
    </div>
  );
}
