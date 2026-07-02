"use client";

import { useMemo } from "react";
import { collection, orderBy, query, type Query } from "firebase/firestore";
import { Bot, Hand, LoaderCircle, PauseCircle } from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { cn } from "@/lib/utils";
import { parseCanonical } from "@/lib/whatsapp-inbox/time";
import type { InboxConversation, WhatsAppMode } from "@/types/whatsapp-inbox";

const MODE_META: Record<WhatsAppMode, { label: string; icon: typeof Bot; className: string }> = {
  BOT: { label: "Bot", icon: Bot, className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  HUMAN: { label: "Tú", icon: Hand, className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  PAUSED: { label: "Pausa", icon: PauseCircle, className: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
};

function formatRelative(canonical?: string): string {
  if (!canonical) return "";
  const date = parseCanonical(canonical);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

interface ConversationListProps {
  tenantId: string;
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
}

export function ConversationList({ tenantId, selectedPhone, onSelect }: ConversationListProps) {
  const firestore = useFirestore();

  // Nota: orderBy('lastMessageAt') excluye docs sin ese campo — solo aparecen
  // conversaciones con al menos un mensaje proyectado, que es lo deseado.
  const ref = useMemo(() => {
    if (!firestore || !tenantId) return null;
    return query(
      collection(firestore, "tenants", tenantId, "conversations"),
      orderBy("lastMessageAt", "desc")
    ) as Query<InboxConversation>;
  }, [firestore, tenantId]);

  const { data: conversations, loading, error } = useCollection<InboxConversation>(ref, {
    listen: true,
  });

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-400">
        Error cargando conversaciones: {error.message}
      </div>
    );
  }

  if (!conversations?.length) {
    return (
      <div className="p-6 text-center text-sm text-zinc-500">
        Sin conversaciones todavía. Cuando alguien le escriba al bot, aparecerá aquí.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800/60 px-4 py-3">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          WhatsApp — {conversations.length} conversación{conversations.length === 1 ? "" : "es"}
        </h1>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {conversations.map((conv) => {
          const mode = MODE_META[conv.mode ?? "BOT"];
          const ModeIcon = mode.icon;
          const isSelected = conv.id === selectedPhone;
          const hasInboundLast = conv.lastMessageDirection === "inbound";
          return (
            <li key={conv.id}>
              <button
                type="button"
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-zinc-900 px-4 py-3 text-left transition-colors",
                  isSelected ? "bg-zinc-800/60" : "hover:bg-zinc-900/60"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {hasInboundLast && (
                      <span
                        aria-label="Último mensaje del cliente"
                        className="h-2 w-2 flex-shrink-0 rounded-full bg-cyan-400"
                      />
                    )}
                    <span className="truncate font-medium text-zinc-100">{conv.id}</span>
                    <span className="ml-auto flex-shrink-0 text-xs text-zinc-500">
                      {formatRelative(conv.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-zinc-400">
                    {conv.lastMessagePreview ?? ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-0.5 inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    mode.className
                  )}
                >
                  <ModeIcon className="h-3 w-3" />
                  {mode.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
