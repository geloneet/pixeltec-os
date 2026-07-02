"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  collection,
  doc,
  limitToLast,
  orderBy,
  query,
  type DocumentReference,
  type Query,
} from "firebase/firestore";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useCollection, useDoc, useFirestore } from "@/firebase";
import { cn } from "@/lib/utils";
import type { InboxConversation, InboxMessage } from "@/types/whatsapp-inbox";
import { Composer } from "./Composer";
import { ModeToggle } from "./ModeToggle";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_MESSAGES = 200;

function formatTime(msg: InboxMessage): string {
  const ts = msg.metaTimestamp ?? msg.createdAt;
  if (!ts) return "";
  return ts.toDate().toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ChatThreadProps {
  tenantId: string;
  phone: string;
  onBack: () => void;
}

export function ChatThread({ tenantId, phone, onBack }: ChatThreadProps) {
  const firestore = useFirestore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const convRef = useMemo(() => {
    if (!firestore) return null;
    return doc(
      firestore,
      "tenants",
      tenantId,
      "conversations",
      phone
    ) as DocumentReference<InboxConversation>;
  }, [firestore, tenantId, phone]);

  const messagesRef = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "tenants", tenantId, "conversations", phone, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(MAX_MESSAGES)
    ) as Query<InboxMessage>;
  }, [firestore, tenantId, phone]);

  const { data: conv } = useDoc<InboxConversation>(convRef, { listen: true });
  const { data: messages, loading } = useCollection<InboxMessage>(messagesRef, { listen: true });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const mode = conv?.mode ?? "BOT";

  // Ventana de 24h de Meta: cuenta desde el último mensaje DEL CLIENTE (inbound).
  const windowOpen = useMemo(() => {
    const lastInbound = [...(messages ?? [])]
      .reverse()
      .find((m) => m.direction === "inbound");
    const ts = lastInbound?.metaTimestamp ?? lastInbound?.createdAt;
    if (!ts) return false;
    return Date.now() - ts.toDate().getTime() < WINDOW_MS;
  }, [messages]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header del hilo */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800/60 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-1 text-zinc-400 hover:text-zinc-100 md:hidden"
          aria-label="Volver a la lista"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-zinc-100">{phone}</h2>
          <p className="text-xs text-zinc-500">
            {windowOpen ? "Ventana de 24h abierta" : "Ventana de 24h cerrada"}
          </p>
        </div>
        <ModeToggle phone={phone} mode={mode} />
      </div>

      {/* Mensajes */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center py-8">
            <LoaderCircle className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        )}
        {messages?.map((msg) => {
          const isOutbound = msg.direction === "outbound";
          const isManual = isOutbound && msg.from !== "bot";
          return (
            <div key={msg.id} className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                  isOutbound
                    ? isManual
                      ? "rounded-br-sm bg-emerald-600/25 text-emerald-50"
                      : "rounded-br-sm bg-cyan-600/25 text-cyan-50"
                    : "rounded-bl-sm bg-zinc-800 text-zinc-100"
                )}
              >
                {isOutbound && (
                  <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide opacity-60">
                    {isManual ? "Tú (manual)" : "Bot"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.text ?? `[${msg.type}]`}</p>
                <p className="mt-1 text-right text-[10px] opacity-50">{formatTime(msg)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <Composer phone={phone} mode={mode} windowOpen={windowOpen} />
    </div>
  );
}
