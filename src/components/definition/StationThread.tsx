"use client";

import { Sparkles, Loader2 } from "lucide-react";
import { KnowledgeMarkdown } from "@/components/crm/KnowledgeMarkdown";

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  messages: ThreadMessage[];
  /** Última propuesta de la IA (borrador vigente) si no está ya en messages. */
  generating?: boolean;
}

/**
 * Hilo de la estación: burbujas del usuario a la derecha, propuestas de la IA
 * renderizadas como documento markdown a la izquierda. Patrón visual tomado de
 * ChatThread (whatsapp-inbox), simplificado.
 */
export function StationThread({ messages, generating }: Props) {
  return (
    <div className="space-y-4">
      {messages.map((m) =>
        m.role === "assistant" ? (
          <div
            key={m.id}
            className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4"
          >
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-cyan-400">
              <Sparkles className="h-3.5 w-3.5" />
              PM retador
            </div>
            <KnowledgeMarkdown content={m.content} />
          </div>
        ) : (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-cyan-500/10 px-3.5 py-2.5 text-sm text-zinc-100 ring-1 ring-cyan-500/20">
              {m.content}
            </div>
          </div>
        )
      )}
      {generating && (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          El PM está trabajando en la propuesta…
        </div>
      )}
    </div>
  );
}
