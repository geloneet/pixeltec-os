"use client";

import { useState } from "react";
import type { SessionNote } from "@/types/session";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  notes: SessionNote[];
  onAddNote: (content: string) => void;
}

export function QuickNotepad({ notes, onAddNote }: Props) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAddNote(text.trim());
    setText("");
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <p className="mb-3 text-xs font-semibold text-zinc-400">Notas rápidas</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
          placeholder="Nueva observación..."
          className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/30 focus:outline-none transition-colors"
        />
        <button
          onClick={handleSubmit}
          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-xs font-medium text-zinc-400 transition-all hover:text-zinc-200"
        >
          Guardar
        </button>
      </div>
      {notes.length > 0 && (
        <div className="mt-3 space-y-2">
          {[...notes].reverse().map(note => (
            <div key={note.id} className="rounded-lg border border-white/[0.04] bg-zinc-900/30 px-3 py-2">
              <p className="text-[10px] text-zinc-600">
                {format(new Date(note.createdAt), "HH:mm", { locale: es })}
              </p>
              <p className="text-xs text-zinc-300">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
